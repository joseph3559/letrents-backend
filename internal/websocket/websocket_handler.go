package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from the clients
	broadcast chan []byte

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// User connections by user ID
	userConnections map[uuid.UUID][]*Client

	// Room connections
	roomConnections map[string][]*Client

	// Database connection for logging
	repo WebSocketRepository

	// Mutex for thread-safety
	mutex sync.RWMutex
}

type Client struct {
	// The websocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// User information
	userID uuid.UUID
	role   string
	name   string

	// Current room (conversation ID or broadcast room)
	room string

	// Connection metadata
	connectionID string
	userAgent    string
	ipAddress    string

	// Hub reference
	hub *Hub

	// Last activity
	lastActivity time.Time

	// Connection status
	isActive bool
}

type WebSocketRepository interface {
	LogConnection(ctx context.Context, userID uuid.UUID, connectionID, room, userAgent, ipAddress string) error
	UpdateConnectionStatus(ctx context.Context, connectionID, status string) error
	GetActiveConnections(ctx context.Context, userID uuid.UUID) ([]string, error)
	CleanupInactiveConnections(ctx context.Context) error
}

type WebSocketMessage struct {
	Type      string          `json:"type"`
	Action    string          `json:"action"`
	Data      json.RawMessage `json:"data"`
	Timestamp time.Time       `json:"timestamp"`
	Sender    MessageSender   `json:"sender,omitempty"`
	Room      string          `json:"room,omitempty"`
	MessageID uuid.UUID       `json:"message_id,omitempty"`
}

type MessageSender struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Role string    `json:"role"`
}

type UserStatus struct {
	UserID   uuid.UUID `json:"user_id"`
	Status   string    `json:"status"` // online, offline, away
	LastSeen time.Time `json:"last_seen"`
}

type TypingIndicator struct {
	UserID         uuid.UUID `json:"user_id"`
	UserName       string    `json:"user_name"`
	ConversationID uuid.UUID `json:"conversation_id"`
	IsTyping       bool      `json:"is_typing"`
}

type MessageDeliveryStatus struct {
	MessageID uuid.UUID `json:"message_id"`
	Status    string    `json:"status"` // sent, delivered, read
	UserID    uuid.UUID `json:"user_id"`
	Timestamp time.Time `json:"timestamp"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin for now
		// In production, implement proper origin checking
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

func NewHub(repo WebSocketRepository) *Hub {
	return &Hub{
		clients:         make(map[*Client]bool),
		broadcast:       make(chan []byte),
		register:        make(chan *Client),
		unregister:      make(chan *Client),
		userConnections: make(map[uuid.UUID][]*Client),
		roomConnections: make(map[string][]*Client),
		repo:            repo,
	}
}

func (h *Hub) Run() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)

		case <-ticker.C:
			// Cleanup inactive connections every 5 minutes
			h.cleanupInactiveConnections()
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client] = true

	// Add to user connections
	if _, exists := h.userConnections[client.userID]; !exists {
		h.userConnections[client.userID] = make([]*Client, 0)
	}
	h.userConnections[client.userID] = append(h.userConnections[client.userID], client)

	// Add to room connections if client is in a room
	if client.room != "" {
		if _, exists := h.roomConnections[client.room]; !exists {
			h.roomConnections[client.room] = make([]*Client, 0)
		}
		h.roomConnections[client.room] = append(h.roomConnections[client.room], client)
	}

	// Log connection to database
	ctx := context.Background()
	err := h.repo.LogConnection(ctx, client.userID, client.connectionID, client.room, client.userAgent, client.ipAddress)
	if err != nil {
		log.Printf("Failed to log WebSocket connection: %v", err)
	}

	// Notify other users that this user is online
	h.broadcastUserStatus(client.userID, "online")

	log.Printf("Client registered: %s (%s) in room: %s", client.name, client.userID, client.room)
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)

		// Remove from user connections
		if connections, exists := h.userConnections[client.userID]; exists {
			for i, conn := range connections {
				if conn == client {
					h.userConnections[client.userID] = append(connections[:i], connections[i+1:]...)
					break
				}
			}
			// If no more connections for this user, remove the entry
			if len(h.userConnections[client.userID]) == 0 {
				delete(h.userConnections, client.userID)
			}
		}

		// Remove from room connections
		if client.room != "" {
			if connections, exists := h.roomConnections[client.room]; exists {
				for i, conn := range connections {
					if conn == client {
						h.roomConnections[client.room] = append(connections[:i], connections[i+1:]...)
						break
					}
				}
				// If no more connections for this room, remove the entry
				if len(h.roomConnections[client.room]) == 0 {
					delete(h.roomConnections, client.room)
				}
			}
		}

		// Update connection status in database
		ctx := context.Background()
		err := h.repo.UpdateConnectionStatus(ctx, client.connectionID, "disconnected")
		if err != nil {
			log.Printf("Failed to update connection status: %v", err)
		}

		// If this was the last connection for the user, broadcast offline status
		if _, exists := h.userConnections[client.userID]; !exists {
			h.broadcastUserStatus(client.userID, "offline")
		}

		log.Printf("Client unregistered: %s (%s)", client.name, client.userID)
	}
}

func (h *Hub) broadcastMessage(message []byte) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	var wsMsg WebSocketMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		log.Printf("Failed to parse WebSocket message: %v", err)
		return
	}

	// Determine target clients based on message type and room
	var targetClients []*Client

	if wsMsg.Room != "" {
		// Send to specific room
		if connections, exists := h.roomConnections[wsMsg.Room]; exists {
			targetClients = connections
		}
	} else {
		// Broadcast to all clients
		for client := range h.clients {
			targetClients = append(targetClients, client)
		}
	}

	// Send message to target clients
	for _, client := range targetClients {
		// Don't send message back to sender
		if wsMsg.Sender.ID != uuid.Nil && client.userID == wsMsg.Sender.ID {
			continue
		}

		select {
		case client.send <- message:
		default:
			// Client's send channel is full, close it
			close(client.send)
			delete(h.clients, client)
		}
	}
}

func (h *Hub) broadcastUserStatus(userID uuid.UUID, status string) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	statusMsg := WebSocketMessage{
		Type:      "user_status",
		Action:    "status_changed",
		Timestamp: time.Now(),
		Data:      json.RawMessage(fmt.Sprintf(`{"user_id":"%s","status":"%s","timestamp":"%s"}`, userID, status, time.Now().Format(time.RFC3339))),
	}

	msgBytes, _ := json.Marshal(statusMsg)

	// Broadcast to all clients
	for client := range h.clients {
		select {
		case client.send <- msgBytes:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}

func (h *Hub) SendToUser(userID uuid.UUID, message WebSocketMessage) error {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	connections, exists := h.userConnections[userID]
	if !exists {
		return fmt.Errorf("user %s is not connected", userID)
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Send to all user's connections
	for _, client := range connections {
		select {
		case client.send <- msgBytes:
		default:
			// Client's send channel is full, skip
			log.Printf("Failed to send message to client %s, channel full", client.connectionID)
		}
	}

	return nil
}

func (h *Hub) SendToRoom(room string, message WebSocketMessage) error {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	connections, exists := h.roomConnections[room]
	if !exists {
		return fmt.Errorf("no connections in room %s", room)
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Send to all room connections
	for _, client := range connections {
		select {
		case client.send <- msgBytes:
		default:
			log.Printf("Failed to send message to client %s in room %s", client.connectionID, room)
		}
	}

	return nil
}

func (h *Hub) GetOnlineUsers() []uuid.UUID {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	var users []uuid.UUID
	for userID := range h.userConnections {
		users = append(users, userID)
	}
	return users
}

func (h *Hub) IsUserOnline(userID uuid.UUID) bool {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	_, exists := h.userConnections[userID]
	return exists
}

func (h *Hub) cleanupInactiveConnections() {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	now := time.Now()
	inactiveThreshold := 10 * time.Minute

	var inactiveClients []*Client
	for client := range h.clients {
		if now.Sub(client.lastActivity) > inactiveThreshold {
			inactiveClients = append(inactiveClients, client)
		}
	}

	// Remove inactive clients
	for _, client := range inactiveClients {
		delete(h.clients, client)
		close(client.send)
	}

	if len(inactiveClients) > 0 {
		log.Printf("Cleaned up %d inactive WebSocket connections", len(inactiveClients))
	}

	// Cleanup database connections
	ctx := context.Background()
	h.repo.CleanupInactiveConnections(ctx)
}

// HTTP handler for WebSocket upgrade
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// For demo purposes, skip JWT validation
	// TODO: Implement proper JWT validation
	// userClaims, err := utils.GetUserFromContext(r.Context())
	// if err != nil {
	//     http.Error(w, "Unauthorized", http.StatusUnauthorized)
	//     return
	// }

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// For now, use a simple demo user
	// TODO: Implement proper JWT claim parsing
	demoUserID := uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa")

	// Create client
	client := &Client{
		conn:         conn,
		send:         make(chan []byte, 256),
		userID:       demoUserID,
		role:         "landlord",
		name:         "Demo User",
		connectionID: uuid.New().String(),
		userAgent:    r.Header.Get("User-Agent"),
		ipAddress:    r.RemoteAddr,
		hub:          h,
		lastActivity: time.Now(),
		isActive:     true,
	}

	// Get room from query parameter (optional)
	if room := r.URL.Query().Get("room"); room != "" {
		client.room = room
	}

	// Register client and start goroutines
	client.hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in new goroutines
	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		c.lastActivity = time.Now()
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.lastActivity = time.Now()

		// Parse incoming message
		var wsMsg WebSocketMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("Failed to parse incoming WebSocket message: %v", err)
			continue
		}

		// Set sender information
		wsMsg.Sender = MessageSender{
			ID:   c.userID,
			Name: c.name,
			Role: c.role,
		}
		wsMsg.Timestamp = time.Now()

		// Handle different message types
		switch wsMsg.Type {
		case "chat_message":
			// Broadcast chat message to room or all clients
			msgBytes, _ := json.Marshal(wsMsg)
			c.hub.broadcast <- msgBytes

		case "typing_indicator":
			// Handle typing indicators
			msgBytes, _ := json.Marshal(wsMsg)
			c.hub.broadcast <- msgBytes

		case "message_status":
			// Handle message delivery/read status updates
			msgBytes, _ := json.Marshal(wsMsg)
			c.hub.broadcast <- msgBytes

		case "join_room":
			// Handle room joining
			var roomData struct {
				Room string `json:"room"`
			}
			if err := json.Unmarshal(wsMsg.Data, &roomData); err == nil {
				c.room = roomData.Room
				// Re-register client to update room connections
				c.hub.register <- c
			}

		case "leave_room":
			// Handle room leaving
			c.room = ""
			// Re-register client to update room connections
			c.hub.register <- c

		case "ping":
			// Handle ping/pong for keep-alive
			pongMsg := WebSocketMessage{
				Type:      "pong",
				Timestamp: time.Now(),
			}
			msgBytes, _ := json.Marshal(pongMsg)
			select {
			case c.send <- msgBytes:
			default:
				close(c.send)
				return
			}

		default:
			log.Printf("Unknown WebSocket message type: %s", wsMsg.Type)
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
