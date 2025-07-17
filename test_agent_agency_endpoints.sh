#!/bin/bash

# Test script for Agent and Agency Admin API endpoints

BASE_URL="http://localhost:8080/api/v1"

# Test tokens (demo tokens for testing)
AGENCY_ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VuY3lfaWQiOiI1NTU1NTU1NS01NTU1LTU1NTUtNTU1NS01NTU1NTU1NTU1NTUiLCJlbWFpbCI6ImFnZW5jeUBkZW1vLmNvbSIsImV4cCI6MjE0NzQ4MzY0NywiZmlyc3RfbmFtZSI6IkFnZW5jeSIsImlhdCI6MTczNzEyMjA0NywiaWQiOiJhZ2VuY3ktYWRtaW4tZGVtby1pZCIsImxhc3RfbmFtZSI6IkFkbWluIiwicm9sZSI6ImFnZW5jeV9hZG1pbiJ9.V5qy6VxtT_-lJhFvs09PgQJqrD_8VDEKgkWkG-QBD2E"

AGENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VuY3lfaWQiOiI1NTU1NTU1NS01NTU1LTU1NTUtNTU1NS01NTU1NTU1NTU1NTUiLCJlbWFpbCI6ImFnZW50QGRlbW8uY29tIiwiZXhwIjoyMTQ3NDgzNjQ3LCJmaXJzdF9uYW1lIjoiQWdlbnQiLCJpYXQiOjE3MzcxMjIwNDcsImlkIjoiYWdlbnQtZGVtby1pZCIsImxhc3RfbmFtZSI6IlVzZXIiLCJyb2xlIjoiYWdlbnQifQ.7KvFc4qzOzWqnNs1xPbH5SfzN2K8LMqpVGH9XgF3wCs"

echo "🚀 Testing Agent and Agency Admin API Endpoints"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API request and show result
test_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local description=$4
    local data=$5
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo -e "${YELLOW}Endpoint:${NC} $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "HTTPSTATUS:%{http_code}")
    else
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -w "HTTPSTATUS:%{http_code}")
    fi
    
    # Extract HTTP status code
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    # Extract response body
    body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ $http_code -eq 200 ] || [ $http_code -eq 201 ]; then
        echo -e "${GREEN}✓ SUCCESS${NC} (HTTP $http_code)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "$body"
    fi
}

# Test health endpoint first
echo -e "\n${BLUE}===== HEALTH CHECK =====${NC}"
test_endpoint "GET" "/health" "" "Health check"

# Test Agency Admin Endpoints
echo -e "\n${BLUE}===== AGENCY ADMIN ENDPOINTS =====${NC}"

test_endpoint "GET" "/agency-admin/dashboard/kpis" "$AGENCY_ADMIN_TOKEN" "Agency Admin Dashboard KPIs"
test_endpoint "GET" "/agency-admin/dashboard/charts" "$AGENCY_ADMIN_TOKEN" "Agency Admin Dashboard Charts"
test_endpoint "GET" "/agency-admin/staff/agents" "$AGENCY_ADMIN_TOKEN" "Get Agents List"
test_endpoint "GET" "/agency-admin/staff/caretakers" "$AGENCY_ADMIN_TOKEN" "Get Caretakers List"

# Test Agent Endpoints
echo -e "\n${BLUE}===== AGENT ENDPOINTS =====${NC}"

test_endpoint "GET" "/agent/dashboard" "$AGENT_TOKEN" "Agent Dashboard Overview"
test_endpoint "GET" "/agent/dashboard/stats" "$AGENT_TOKEN" "Agent Dashboard Stats"
test_endpoint "GET" "/agent/properties" "$AGENT_TOKEN" "Agent Assigned Properties"
test_endpoint "GET" "/agent/units" "$AGENT_TOKEN" "Agent Units Overview"
test_endpoint "GET" "/agent/tenants" "$AGENT_TOKEN" "Agent Tenants Overview"
test_endpoint "GET" "/agent/notifications" "$AGENT_TOKEN" "Agent Notifications"

# Test error cases (without auth)
echo -e "\n${BLUE}===== ERROR HANDLING TESTS =====${NC}"

test_endpoint "GET" "/agency-admin/dashboard/kpis" "" "Agency Admin KPIs (No Auth - Should Fail)"
test_endpoint "GET" "/agent/dashboard" "" "Agent Dashboard (No Auth - Should Fail)"

# Test with wrong role
echo -e "\n${BLUE}===== ROLE PERMISSION TESTS =====${NC}"

test_endpoint "GET" "/agency-admin/dashboard/kpis" "$AGENT_TOKEN" "Agency Admin KPIs with Agent Token (Should Fail)"
test_endpoint "GET" "/agent/dashboard" "$AGENCY_ADMIN_TOKEN" "Agent Dashboard with Agency Admin Token (Should Fail)"

echo -e "\n${GREEN}===== TEST SUMMARY =====${NC}"
echo "✅ All endpoint tests completed!"
echo "📝 Check the results above for any failed endpoints"
echo "🔗 API documentation available at: backend/AGENCY_AGENT_API_DOCS.md"

echo -e "\n${BLUE}===== FRONTEND INTEGRATION TESTS =====${NC}"
echo "🌐 Frontend pages to test:"
echo "  - Agency Admin Dashboard: http://localhost:3000/agency-admin"
echo "  - Agent Dashboard: http://localhost:3000/agent"
echo ""
echo "📋 Test checklist:"
echo "  □ Dashboard loads without errors"
echo "  □ KPIs display correctly"
echo "  □ Properties and tenants load"
echo "  □ Notifications appear"
echo "  □ Navigation works properly"
echo "  □ API error handling works" 