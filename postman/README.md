# LetRents API Postman Collection

Complete Postman collection for testing all LetRents API endpoints.

## 📦 Files Included

- `LetRents_API_Collection.postman_collection.json` - Main API collection with all endpoints
- `LetRents_API_Environment.postman_environment.json` - Environment variables for development
- `README.md` - This file

## 🚀 Quick Start

### 1. Import Collection and Environment

1. Open Postman
2. Click **Import** button
3. Import both files:
   - `LetRents_API_Collection.postman_collection.json`
   - `LetRents_API_Environment.postman_environment.json`
4. Select the **LetRents API - Development** environment from the dropdown

### 2. Configure Environment Variables

The environment file includes these variables:
- `base_url`: API base URL (default: `http://localhost:8080/api/v1`)
- `token`: JWT token (auto-set after login)
- `user_id`, `user_role`, `company_id`: User info (auto-set after login)
- `property_id`, `unit_id`, `tenant_id`, etc.: Resource IDs (auto-set when resources are created)

**To change the base URL:**
1. Click on the environment name in the top right
2. Click **Edit**
3. Update the `base_url` value
4. Click **Save**

### 3. Authenticate

1. Navigate to **Authentication > Login**
2. Update the request body with your credentials:
   ```json
   {
       "email": "your-email@example.com",
       "password": "your-password"
   }
   ```
3. Click **Send**
4. The `token` will be automatically saved to the environment
5. All subsequent requests will use this token automatically

### 4. Test Endpoints

All endpoints are organized by resource:
- **Authentication** - Login, register, password reset
- **Properties** - CRUD operations for properties
- **Units** - Unit management
- **Tenants** - Tenant management
- **Invoices** - Invoice operations
- **Payments** - Payment processing
- **Maintenance** - Maintenance requests
- **Dashboard** - Dashboard statistics
- **Reports** - Various reports
- **Leases** - Lease management
- **Tenant Portal** - Tenant-specific endpoints
- **System** - Health checks

## ✅ Automated Tests

All requests include automated tests that:
- Verify status codes
- Validate response structure
- Auto-save resource IDs for use in subsequent requests

### Test Examples

- **Login**: Saves token, user_id, user_role automatically
- **List Resources**: Saves first resource ID automatically
- **Create Resources**: Saves created resource ID automatically

## 🔧 Customization

### Adding New Endpoints

1. Right-click on a folder
2. Select **Add Request**
3. Configure the request:
   - Method (GET, POST, PUT, DELETE, etc.)
   - URL: Use `{{base_url}}/your-endpoint`
   - Headers: Add `Authorization: Bearer {{token}}` for protected endpoints
   - Body: Add request body if needed
4. Add tests in the **Tests** tab

### Running Collection

1. Click on the collection name
2. Click **Run**
3. Select which requests to run
4. Click **Run LetRents API v2.0**
5. View results

## 📝 Notes

- **Authentication**: Most endpoints require authentication. The token is automatically included in requests via the `Authorization` header.
- **Environment Variables**: Resource IDs are automatically saved when you create or list resources, making it easy to test related endpoints.
- **Error Handling**: All requests include tests to verify successful responses. Check the **Test Results** tab after each request.

## 🌐 Production Setup

To test against production:

1. Create a new environment: **LetRents API - Production**
2. Set `base_url` to: `https://api.letrents.com/api/v1`
3. Use production credentials for login

## 🐛 Troubleshooting

### Token Not Working
- Make sure you've run the Login request first
- Check that the token is saved in the environment
- Verify the token hasn't expired

### 404 Errors
- Check that the server is running
- Verify the `base_url` is correct
- Ensure the endpoint path is correct

### 401 Unauthorized
- Run the Login request again to get a fresh token
- Check that the Authorization header is included

## 📚 Additional Resources

- **Swagger Documentation**: Visit `http://localhost:8080/docs` when server is running
- **API Documentation**: See `API.md` in the project root
- **README**: See main `README.md` for server setup instructions

---

**Happy Testing! 🚀**

