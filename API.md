# LetRents Property Management API v2.0.0

## 🚀 Quick Start

### Health Check
```bash
curl http://localhost:8080/health
```

### API Information
```bash
curl http://localhost:8080/api/v1
```

## 📡 Base URLs

- **Development:** `http://localhost:8080`
- **Production:** `https://api.letrents.com`

## 🔐 Authentication

All API requests (except health checks) require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <your_jwt_token>
```

## 📚 Available Endpoints

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API root information |
| GET | `/health` | Health check (simple) |
| GET | `/api/v1` | API v1 information |
| GET | `/api/v1/health` | Health check (detailed) |
| GET | `/docs` | Swagger documentation |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/logout` | User logout |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |
| POST | `/api/v1/auth/verify-email` | Verify email address |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password |

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/properties` | List all properties |
| POST | `/api/v1/properties` | Create property |
| GET | `/api/v1/properties/:id` | Get property details |
| PUT | `/api/v1/properties/:id` | Update property |
| DELETE | `/api/v1/properties/:id` | Delete property |

### Units

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/units` | List all units |
| POST | `/api/v1/units` | Create unit |
| GET | `/api/v1/units/:id` | Get unit details |
| PUT | `/api/v1/units/:id` | Update unit |
| DELETE | `/api/v1/units/:id` | Delete unit |

### Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenants` | List all tenants |
| POST | `/api/v1/tenants` | Create tenant |
| GET | `/api/v1/tenants/:id` | Get tenant details |
| PUT | `/api/v1/tenants/:id` | Update tenant |
| DELETE | `/api/v1/tenants/:id` | Delete tenant |
| GET | `/api/v1/tenants/:id/payments` | Get tenant payments |
| POST | `/api/v1/tenants/:id/payments` | Create payment for tenant |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/payments` | List all payments |
| POST | `/api/v1/payments` | Create payment |
| GET | `/api/v1/payments/:id` | Get payment details |
| PUT | `/api/v1/payments/:id` | Update payment |
| DELETE | `/api/v1/payments/:id` | Delete payment |
| POST | `/api/v1/payments/:id/approve` | Approve payment |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/invoices` | List all invoices |
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices/:id` | Get invoice details |
| PUT | `/api/v1/invoices/:id` | Update invoice |
| DELETE | `/api/v1/invoices/:id` | Delete invoice |
| POST | `/api/v1/invoices/:id/send` | Send invoice to tenant |

### Maintenance Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/maintenance` | List maintenance requests |
| POST | `/api/v1/maintenance` | Create maintenance request |
| GET | `/api/v1/maintenance/:id` | Get request details |
| PUT | `/api/v1/maintenance/:id` | Update request |
| DELETE | `/api/v1/maintenance/:id` | Delete request |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/dashboard` | Dashboard statistics |
| GET | `/api/v1/reports/financial` | Financial reports |
| GET | `/api/v1/reports/occupancy` | Occupancy reports |
| GET | `/api/v1/reports/maintenance` | Maintenance reports |

### Tenant Portal

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant-portal/dashboard` | Tenant dashboard |
| GET | `/api/v1/tenant-portal/profile` | Tenant profile |
| GET | `/api/v1/tenant-portal/payments` | Tenant payments |
| GET | `/api/v1/tenant-portal/invoices` | Tenant invoices |
| GET | `/api/v1/tenant-portal/maintenance` | Tenant maintenance requests |

## 📦 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

## 🔒 Role-Based Access Control (RBAC)

The API implements role-based access control with the following roles:

- **super_admin**: Full system access
- **agency_admin**: Agency-level management
- **landlord**: Property owner access
- **agent**: Property agent access
- **caretaker**: Property caretaker access
- **tenant**: Tenant portal access

## 🚦 Rate Limiting

- **Authenticated requests:** 1000 requests per hour
- **Unauthenticated requests:** 100 requests per hour

## 📊 Pagination

List endpoints support pagination using query parameters:

```
GET /api/v1/properties?page=1&limit=20
```

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

## 🔍 Filtering & Sorting

Most list endpoints support filtering and sorting:

```
GET /api/v1/properties?status=active&sort=-created_at
```

**Common filters:**
- `status`: Filter by status
- `search`: Full-text search
- `sort`: Sort field (prefix with `-` for descending)

## 🛠️ Development

### Running the Server
```bash
cd "backend v2"
npm run dev
```

### Environment Variables
```env
NODE_ENV=development
PORT=8080
HOST=0.0.0.0
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
```

## 📝 Changelog

### v2.0.0 (2025-10-24)
- ✅ Added professional health endpoints
- ✅ Enhanced error handling with 404 responses
- ✅ Added API root information endpoints
- ✅ Improved startup logging
- ✅ Fixed tenant payment access permissions
- ✅ Added invoice data to payment details

## 🤝 Support

For issues or questions, contact the development team.

---

**Built with ❤️ by the LetRents Team**


