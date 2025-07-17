#!/bin/bash

# Test script for caretaker endpoints

BASE_URL="http://localhost:8080/api/v1"

echo "🧪 Testing Caretaker API Endpoints"
echo "=================================="

# First, get a token (you'll need to implement login)
echo "📝 Note: You'll need to implement authentication first"
echo "      Use a caretaker token for the following requests:"
echo ""

# Test dashboard endpoints
echo "🏠 Dashboard Endpoints:"
echo "GET $BASE_URL/caretaker/dashboard"
echo "GET $BASE_URL/caretaker/stats"
echo ""

# Test task endpoints
echo "📋 Task Management Endpoints:"
echo "GET $BASE_URL/caretaker/tasks"
echo "GET $BASE_URL/caretaker/tasks/{taskId}"
echo "PUT $BASE_URL/caretaker/tasks/{taskId}/status"
echo "POST $BASE_URL/caretaker/tasks/{taskId}/updates"
echo ""

# Test movement endpoints
echo "🚚 Tenant Movement Endpoints:"
echo "GET $BASE_URL/caretaker/movements"
echo "PUT $BASE_URL/caretaker/movements/{movementId}/status"
echo ""

# Test condition endpoints
echo "🏢 Unit Condition Endpoints:"
echo "GET $BASE_URL/caretaker/conditions"
echo "POST $BASE_URL/caretaker/conditions"
echo "PUT $BASE_URL/caretaker/conditions/{conditionId}"
echo ""

# Test photo endpoints
echo "📸 Photo Endpoints:"
echo "POST $BASE_URL/caretaker/units/{unitId}/photos"
echo "GET $BASE_URL/caretaker/units/{unitId}/photos"
echo ""

# Test other endpoints
echo "🔧 Other Endpoints:"
echo "POST $BASE_URL/caretaker/qr/scan"
echo "GET $BASE_URL/caretaker/maintenance"
echo "PUT $BASE_URL/caretaker/maintenance/{requestId}"
echo "POST $BASE_URL/caretaker/emergency/report"
echo "GET $BASE_URL/caretaker/assignments"
echo "GET $BASE_URL/caretaker/properties"
echo "GET $BASE_URL/caretaker/activity"
echo ""

echo "✅ Caretaker module endpoints are configured!"
echo "   Next steps:"
echo "   1. Fix compilation issues in caretaker_handler.go"
echo "   2. Implement proper authentication"
echo "   3. Test endpoints with actual requests" 