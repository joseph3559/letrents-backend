# LetRents API Testing Guide

Complete guide for testing all API endpoints before production deployment.

## 🎯 Pre-Production Checklist

### ✅ 1. Server Setup
- [ ] Server is running on port 8080
- [ ] Database is connected and migrations are up to date
- [ ] Environment variables are configured correctly
- [ ] Swagger documentation is accessible at `/docs`

### ✅ 2. Postman Collection Setup
- [ ] Import Postman collection from `postman/LetRents_API_Collection.postman_collection.json`
- [ ] Import environment from `postman/LetRents_API_Environment.postman_environment.json`
- [ ] Select the "LetRents API - Development" environment
- [ ] Verify `base_url` is set to `http://localhost:8080/api/v1`

### ✅ 3. Authentication Testing
- [ ] **Login** - Test with valid credentials
  - Verify token is received
  - Verify token is auto-saved to environment
  - Verify user data is returned correctly
- [ ] **Register** - Test user registration (if applicable)
- [ ] **Get Current User** - Verify authenticated user endpoint
- [ ] **Refresh Token** - Test token refresh

### ✅ 4. Properties Endpoints
- [ ] **List Properties** - Verify pagination and filtering
- [ ] **Create Property** - Create a test property
- [ ] **Get Property** - Retrieve created property
- [ ] **Update Property** - Update property details
- [ ] **Get Property Analytics** - Verify analytics data
- [ ] **Get Property Units** - List units for property
- [ ] **Delete Property** - Clean up test data (optional)

### ✅ 5. Units Endpoints
- [ ] **List Units** - Verify unit listing
- [ ] **Create Unit** - Create a test unit
- [ ] **Get Unit** - Retrieve unit details
- [ ] **Update Unit** - Update unit information
- [ ] **Update Unit Status** - Change unit status
- [ ] **Assign Tenant** - Assign tenant to unit
- [ ] **Release Tenant** - Release tenant from unit
- [ ] **Search Available Units** - Test public search endpoint

### ✅ 6. Tenants Endpoints
- [ ] **List Tenants** - Verify tenant listing
- [ ] **Create Tenant** - Create a test tenant
- [ ] **Get Tenant** - Retrieve tenant details
- [ ] **Update Tenant** - Update tenant information
- [ ] **Assign Unit** - Assign unit to tenant
- [ ] **Get Tenant Payments** - List tenant payments
- [ ] **Get Tenant Maintenance** - List maintenance requests
- [ ] **Send Invitation** - Send tenant invitation
- [ ] **Terminate Tenant** - Test tenant termination

### ✅ 7. Invoices Endpoints
- [ ] **List Invoices** - Verify invoice listing
- [ ] **Create Invoice** - Create a test invoice
- [ ] **Get Invoice** - Retrieve invoice details
- [ ] **Update Invoice** - Update invoice information
- [ ] **Send Invoice** - Send invoice to tenant
- [ ] **Mark as Paid** - Mark invoice as paid
- [ ] **Delete Invoice** - Clean up test data

### ✅ 8. Payments Endpoints
- [ ] **List Payments** - Verify payment listing
- [ ] **Create Payment** - Create a test payment
- [ ] **Get Payment** - Retrieve payment details
- [ ] **Approve Payment** - Approve pending payment
- [ ] **Update Payment** - Update payment information
- [ ] **Delete Payment** - Clean up test data

### ✅ 9. Maintenance Endpoints
- [ ] **List Maintenance Requests** - Verify listing
- [ ] **Create Maintenance Request** - Create a test request
- [ ] **Get Maintenance Request** - Retrieve request details
- [ ] **Update Maintenance Request** - Update request status
- [ ] **Get Maintenance Overview** - Verify overview statistics

### ✅ 10. Dashboard Endpoints
- [ ] **Get Dashboard Stats** - Verify dashboard data
- [ ] **Get Onboarding Status** - Check onboarding progress

### ✅ 11. Reports Endpoints
- [ ] **Financial Report** - Generate financial report
- [ ] **Occupancy Report** - Generate occupancy report
- [ ] **Maintenance Report** - Generate maintenance report

### ✅ 12. Leases Endpoints
- [ ] **List Leases** - Verify lease listing
- [ ] **Create Lease** - Create a test lease
- [ ] **Get Lease** - Retrieve lease details
- [ ] **Update Lease** - Update lease information
- [ ] **Terminate Lease** - Test lease termination
- [ ] **Renew Lease** - Test lease renewal

### ✅ 13. Tenant Portal Endpoints
- [ ] **Get Tenant Dashboard** - Verify tenant dashboard
- [ ] **Get Tenant Profile** - Retrieve tenant profile
- [ ] **Get Tenant Payments** - List tenant payments
- [ ] **Get Tenant Invoices** - List tenant invoices
- [ ] **Get Tenant Maintenance** - List maintenance requests

### ✅ 14. System Endpoints
- [ ] **Health Check** - Verify `/health` endpoint
- [ ] **API Info** - Verify `/api/v1` endpoint
- [ ] **Swagger Docs** - Verify `/docs` is accessible

## 🧪 Running Automated Tests

### Using Postman Collection Runner

1. Click on the collection name
2. Click **Run**
3. Select all requests or specific folders
4. Click **Run LetRents API v2.0**
5. Review test results

### Expected Results

All tests should pass with:
- ✅ Status codes match expected values
- ✅ Response structure is correct
- ✅ Required fields are present
- ✅ Data types are correct

## 🔍 Manual Testing Checklist

### Authentication & Authorization
- [ ] Test with invalid credentials (should return 401)
- [ ] Test with expired token (should return 401)
- [ ] Test with missing token (should return 401)
- [ ] Test role-based access control (RBAC)

### Error Handling
- [ ] Test with invalid IDs (should return 404)
- [ ] Test with invalid request body (should return 400)
- [ ] Test with missing required fields (should return 400)
- [ ] Test with duplicate data (should return 409)

### Pagination & Filtering
- [ ] Test pagination with different page numbers
- [ ] Test limit parameter (max 100)
- [ ] Test search functionality
- [ ] Test filtering by status, type, etc.
- [ ] Test sorting functionality

### Data Validation
- [ ] Test with invalid email formats
- [ ] Test with invalid phone numbers
- [ ] Test with invalid dates
- [ ] Test with negative amounts
- [ ] Test with empty strings where not allowed

## 🚨 Common Issues & Solutions

### Issue: Token Not Working
**Solution**: 
1. Run the Login request again
2. Check that token is saved in environment
3. Verify token hasn't expired (default: 24 hours)

### Issue: 404 Not Found
**Solution**:
1. Verify server is running
2. Check base_url is correct
3. Verify endpoint path is correct
4. Check that resource ID exists

### Issue: 401 Unauthorized
**Solution**:
1. Re-authenticate using Login endpoint
2. Verify Authorization header format: `Bearer <token>`
3. Check token hasn't expired

### Issue: 403 Forbidden
**Solution**:
1. Verify user role has required permissions
2. Check RBAC configuration
3. Verify user has access to the resource

### Issue: 500 Internal Server Error
**Solution**:
1. Check server logs for error details
2. Verify database connection
3. Check environment variables
4. Review error message in response

## 📊 Performance Testing

### Load Testing (Optional)
- Test with multiple concurrent requests
- Monitor response times
- Check database query performance
- Verify pagination doesn't slow down with large datasets

### Recommended Tools
- **Postman Collection Runner** - For sequential testing
- **Newman** - For CI/CD integration
- **k6** or **Artillery** - For load testing

## 🔐 Security Testing

- [ ] Verify HTTPS in production
- [ ] Test SQL injection prevention
- [ ] Test XSS prevention
- [ ] Verify CORS configuration
- [ ] Test rate limiting (if implemented)
- [ ] Verify sensitive data is not exposed in responses

## 📝 Test Data Management

### Creating Test Data
1. Use the Create endpoints to set up test data
2. Save IDs in Postman environment variables
3. Use these IDs for subsequent requests

### Cleaning Up
1. Delete test data after testing
2. Or use a separate test database
3. Reset environment variables if needed

## ✅ Sign-Off Checklist

Before going to production:

- [ ] All critical endpoints tested
- [ ] All automated tests passing
- [ ] Error handling verified
- [ ] Authentication working correctly
- [ ] RBAC permissions verified
- [ ] Swagger documentation up to date
- [ ] Postman collection complete
- [ ] Environment variables configured
- [ ] Server logs reviewed
- [ ] Performance acceptable
- [ ] Security checks passed

## 🚀 Production Deployment

After all tests pass:

1. Update environment variables for production
2. Update `base_url` in Postman environment
3. Test critical endpoints in production
4. Monitor logs and errors
5. Set up monitoring and alerts

---

**Last Updated**: 2024-01-15
**Version**: 2.0.0

