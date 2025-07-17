package routes

import (
	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/api/middleware"

	"github.com/gorilla/mux"
)

func RegisterCommunicationRoutes(router *mux.Router, communicationHandler *handler.CommunicationHandler, authMiddleware *middleware.AuthMiddleware) {
	// Create communication subrouter
	comm := router.PathPrefix("/api/communication").Subrouter()

	// Apply authentication middleware to all communication routes
	comm.Use(authMiddleware.RequireAuth)

	// Message endpoints
	comm.HandleFunc("/messages", communicationHandler.GetMessages).Methods("GET")
	comm.HandleFunc("/messages", communicationHandler.SendMessage).Methods("POST")
	comm.HandleFunc("/messages/{message_id}/read", communicationHandler.MarkMessageAsRead).Methods("POST")

	// Conversation endpoints
	comm.HandleFunc("/conversations", communicationHandler.GetConversations).Methods("GET")
	comm.HandleFunc("/conversations", communicationHandler.CreateConversation).Methods("POST")

	// Template endpoints
	comm.HandleFunc("/templates", communicationHandler.GetMessageTemplates).Methods("GET")
	comm.HandleFunc("/templates", communicationHandler.CreateMessageTemplate).Methods("POST")

	// Analytics endpoints
	comm.HandleFunc("/analytics", communicationHandler.GetCommunicationAnalytics).Methods("GET")

	// Attachment endpoints
	comm.HandleFunc("/attachments", communicationHandler.UploadAttachment).Methods("POST")
}
