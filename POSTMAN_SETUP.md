# Postman Collection Setup - Quick Start

## 🎯 Quick Setup (5 minutes)

### Step 1: Import Collection
1. Open Postman
2. Click **Import** button (top left)
3. Drag and drop or select:
   - `postman/LetRents_API_Collection.postman_collection.json`
   - `postman/LetRents_API_Environment.postman_environment.json`
4. Click **Import**

### Step 2: Select Environment
1. Click the environment dropdown (top right)
2. Select **"LetRents API - Development"**

### Step 3: Start Server
```bash
cd "backend v2"
npm run dev
```

### Step 4: Login
1. Navigate to **Authentication > Login**
2. Update email/password in request body:
   ```json
   {
       "email": "admin@letrents.com",
       "password": "your-password"
   }
   ```
3. Click **Send**
4. ✅ Token is automatically saved!

### Step 5: Test Endpoints
- All endpoints are ready to use
- Token is automatically included in requests
- Resource IDs are auto-saved when you create/list resources

## 📋 What's Included

✅ **100+ API Endpoints** organized by resource:
- Authentication (Login, Register, etc.)
- Properties (CRUD + Analytics)
- Units (CRUD + Status Management)
- Tenants (CRUD + Lifecycle)
- Invoices (CRUD + Status)
- Payments (CRUD + Approval)
- Maintenance (CRUD + Overview)
- Dashboard (Stats + Onboarding)
- Reports (Financial, Occupancy, Maintenance)
- Leases (CRUD + Terminate/Renew)
- Tenant Portal (Dashboard, Profile, etc.)
- System (Health Checks)

✅ **Automated Tests** for all requests:
- Status code validation
- Response structure validation
- Auto-save resource IDs

✅ **Environment Variables**:
- `base_url` - API base URL
- `token` - JWT token (auto-set)
- `property_id`, `unit_id`, `tenant_id`, etc. - Resource IDs (auto-set)

## 🔄 Updating Base URL

For production or different environments:

1. Click environment name (top right)
2. Click **Edit**
3. Change `base_url` value:
   - Development: `http://localhost:8080/api/v1`
   - Production: `https://api.letrents.com/api/v1`
4. Click **Save**

## 🧪 Running All Tests

1. Click collection name: **LetRents API v2.0**
2. Click **Run** button
3. Select requests to test
4. Click **Run LetRents API v2.0**
5. Review results

## 📚 Documentation

- **Full Guide**: See `TESTING_GUIDE.md`
- **Postman README**: See `postman/README.md`
- **API Docs**: Visit `http://localhost:8080/docs` (Swagger UI)
- **API Reference**: See `API.md`

## 🚀 Next Steps

1. ✅ Import collection and environment
2. ✅ Start server
3. ✅ Login to get token
4. ✅ Test endpoints
5. ✅ Review test results
6. ✅ Ready for production!

---

**Need Help?** Check `TESTING_GUIDE.md` for detailed testing instructions.

