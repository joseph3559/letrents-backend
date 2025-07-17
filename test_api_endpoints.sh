#!/bin/bash

BASE_URL="http://localhost:8080"
AGENCY_ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VuY3lfaWQiOiI1NTU1NTU1NS01NTU1LTU1NTUtNTU1NS01NTU1NTU1NTU1NTUiLCJlbWFpbCI6ImFnZW5jeUBkZW1vLmNvbSIsImV4cCI6MjE0NzQ4MzY0NywiZmlyc3RfbmFtZSI6IkFnZW5jeSIsImlhdCI6MTczNzEyMjA0NywiaWQiOiJhZ2VuY3ktYWRtaW4tZGVtby1pZCIsImxhc3RfbmFtZSI6IkFkbWluIiwicm9sZSI6ImFnZW5jeV9hZG1pbiJ9.V5qy6VxtT_-lJhFvs09PgQJqrD_8VDEKgkWkG-QBD2E"
AGENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VuY3lfaWQiOiI1NTU1NTU1NS01NTU1LTU1NTUtNTU1NS01NTU1NTU1NTU1NTUiLCJlbWFpbCI6ImFnZW50QGRlbW8uY29tIiwiZXhwIjoyMTQ3NDgzNjQ3LCJmaXJzdF9uYW1lIjoiSmFuZSIsImlhdCI6MTczNzEyMjA0NywiaWQiOiJhZ2VudC1kZW1vLWlkIiwibGFzdF9uYW1lIjoiQWdlbnQiLCJyb2xlIjoiYWdlbnQifQ.uL-c1n-SaEMHqGTONGvOOdPJOWgb5MDDXbPJvbT8rQU"

echo "=== Testing Agency Admin API Endpoints ==="
echo ""

echo "1. Testing Agency Admin Dashboard KPIs..."
curl -X GET "$BASE_URL/api/v1/agency-admin/dashboard/kpis" \
  -H "Authorization: Bearer $AGENCY_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "2. Testing Agency Admin Dashboard Charts..."
curl -X GET "$BASE_URL/api/v1/agency-admin/dashboard/charts" \
  -H "Authorization: Bearer $AGENCY_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "3. Testing Get Agents..."
curl -X GET "$BASE_URL/api/v1/agency-admin/staff/agents" \
  -H "Authorization: Bearer $AGENCY_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "4. Testing Get Caretakers..."
curl -X GET "$BASE_URL/api/v1/agency-admin/staff/caretakers" \
  -H "Authorization: Bearer $AGENCY_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo ""
echo "=== Testing Agent API Endpoints ==="
echo ""

echo "1. Testing Agent Dashboard Overview..."
curl -X GET "$BASE_URL/api/v1/agent/dashboard" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "2. Testing Agent Dashboard Stats..."
curl -X GET "$BASE_URL/api/v1/agent/dashboard/stats" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "3. Testing Agent Assigned Properties..."
curl -X GET "$BASE_URL/api/v1/agent/properties" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "4. Testing Agent Units Overview..."
curl -X GET "$BASE_URL/api/v1/agent/units" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "5. Testing Agent Tenants Overview..."
curl -X GET "$BASE_URL/api/v1/agent/tenants" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "6. Testing Agent Notifications..."
curl -X GET "$BASE_URL/api/v1/agent/notifications" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo ""
echo "=== API Testing Complete ===" 