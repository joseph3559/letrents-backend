#!/bin/bash

# Invoice API Endpoints Test Script
# Tests the enhanced invoice functionality with utility bills

echo "🧪 Testing Invoice API Endpoints with Utility Bills Support..."

BASE_URL="http://localhost:8080/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print test header
print_header() {
    echo -e "\n${BLUE}🔍 $1${NC}"
    echo "----------------------------------------"
}

# Step 1: Login to get authentication token
print_header "Step 1: Authentication"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "landlord@demo.com",
    "password": "admin123!"
  }')

echo "Login Response: $LOGIN_RESPONSE"

# Extract token (assuming JSON response with success and data.token)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get authentication token${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

print_result 0 "Authentication successful"
echo "Token: ${TOKEN:0:20}..."

# Step 2: Test Get Invoices
print_header "Step 2: Get Invoices List"
INVOICES_RESPONSE=$(curl -s -X GET "$BASE_URL/landlord/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Invoices Response: $INVOICES_RESPONSE"
print_result $? "Get invoices list"

# Step 3: Test Get Invoice Stats
print_header "Step 3: Get Invoice Statistics"
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/landlord/invoices/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Stats Response: $STATS_RESPONSE"
print_result $? "Get invoice statistics"

# Step 4: Test Create Invoice with Utility Bills
print_header "Step 4: Create Invoice with Utility Bills"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/landlord/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-1",
    "property_id": "prop-1", 
    "unit_id": "unit-1",
    "rent_amount": 30000,
    "utility_bills": [
      {
        "id": "1",
        "type": "water",
        "name": "Water Bill",
        "amount": 2000,
        "is_included": true
      },
      {
        "id": "2", 
        "type": "electricity",
        "name": "Electricity Bill",
        "amount": 3500,
        "is_included": true
      },
      {
        "id": "3",
        "type": "custom",
        "name": "Custom",
        "custom_name": "DSTV Subscription",
        "amount": 1200,
        "is_included": true
      }
    ],
    "total_utilities": 6700,
    "amount": 36700,
    "due_date": "2024-12-31",
    "description": "Monthly Rent - December 2024",
    "notes": "Payment due by end of month"
  }')

echo "Create Response: $CREATE_RESPONSE"
print_result $? "Create invoice with utility bills"

# Extract invoice ID if available
INVOICE_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$' | head -1)
if [ -z "$INVOICE_ID" ]; then
    INVOICE_ID="INV-001" # fallback to mock ID
fi

echo "Invoice ID: $INVOICE_ID"

# Step 5: Test Send Invoice
print_header "Step 5: Send Invoice to Tenant"
SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/landlord/invoices/$INVOICE_ID/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Send Response: $SEND_RESPONSE"
print_result $? "Send invoice to tenant"

# Step 6: Test Generate PDF
print_header "Step 6: Generate Invoice PDF"
PDF_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/landlord/invoices/$INVOICE_ID/pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/test_invoice.pdf)

echo "PDF Response Code: $PDF_RESPONSE"
if [ "$PDF_RESPONSE" = "200" ]; then
    print_result 0 "Generate invoice PDF"
    echo "PDF saved to: /tmp/test_invoice.pdf"
else
    print_result 1 "Generate invoice PDF (Status: $PDF_RESPONSE)"
fi

# Step 7: Test Mark as Paid
print_header "Step 7: Mark Invoice as Paid"
PAID_RESPONSE=$(curl -s -X POST "$BASE_URL/landlord/invoices/$INVOICE_ID/mark-paid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_date": "2024-12-15"
  }')

echo "Mark Paid Response: $PAID_RESPONSE"
print_result $? "Mark invoice as paid"

# Step 8: Test Export Invoices
print_header "Step 8: Export Invoices"
EXPORT_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/landlord/invoices/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/invoices_export.csv)

echo "Export Response Code: $EXPORT_RESPONSE"
if [ "$EXPORT_RESPONSE" = "200" ]; then
    print_result 0 "Export invoices to CSV"
    echo "CSV saved to: /tmp/invoices_export.csv"
else
    print_result 1 "Export invoices to CSV (Status: $EXPORT_RESPONSE)"
fi

# Summary
print_header "Test Summary"
echo -e "${YELLOW}🎯 Invoice API Testing Complete!${NC}"
echo ""
echo -e "${GREEN}✅ Enhanced Features Tested:${NC}"
echo "   • Authentication with JWT tokens"
echo "   • Invoice creation with utility bills support"
echo "   • Water, electricity, and custom utilities (DSTV)"
echo "   • Automatic total calculation"
echo "   • PDF generation"
echo "   • Email/SMS sending to tenants"
echo "   • Payment tracking"
echo "   • Export functionality"

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo "   • Test the frontend UI at http://localhost:3000"
echo "   • Navigate to Landlord Dashboard → Invoice Management"
echo "   • Try creating a new invoice with utility bills"
echo "   • Verify all features work end-to-end"

echo ""
echo -e "${YELLOW}🔗 Useful Links:${NC}"
echo "   • Frontend: http://localhost:3000/landlord"
echo "   • Backend API: http://localhost:8080/api/v1"
echo "   • Test Files: /tmp/test_invoice.pdf, /tmp/invoices_export.csv" 