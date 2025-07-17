# Pay-Rents Backend

A modern, multi-tenant rent management SaaS platform backend built with Go, designed for the real estate ecosystem with support for agencies, agents, caretakers, tenants, and landlords.

## 🏗️ Architecture

This backend follows **Clean Architecture** principles with clear separation of concerns:

```
backend/
├── cmd/server/              # Application entry point
├── config/                  # Configuration management
├── internal/
│   ├── api/                 # HTTP layer
│   │   ├── handler/         # HTTP handlers
│   │   ├── middleware/      # HTTP middleware
│   │   └── routes/          # Route definitions
│   ├── core/                # Business logic layer
│   │   ├── domain/          # Domain models & entities
│   │   ├── port/            # Repository interfaces
│   │   └── service/         # Business logic services
│   ├── db/                  # Data layer
│   │   ├── postgres/        # PostgreSQL implementations
│   │   └── migration/       # Database migrations
│   └── utils/               # Shared utilities
├── .env                     # Environment variables
├── go.mod                   # Go module definition
└── README.md                # This file
```

## 🧑‍💼 User Roles Hierarchy

```
Platform (Pay-Rents.com)
└── Super Admin (Platform Owner)
    └── Agency
        ├── Agency Admin
        ├── Agents
        │   └── Caretakers
        └── Properties
            └── Tenants
    └── Independent Landlords (optional)
```

### Role Permissions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| **Super Admin** | Platform owner with full access | Manage agencies, users, billing, platform settings |
| **Agency Admin** | Head of property management firm | Manage agency properties, agents, caretakers, reports |
| **Agent** | Property manager within agency | Manage assigned properties, tenants, maintenance |
| **Caretaker** | On-ground building support | Handle maintenance, inspections, tenant issues |
| **Tenant** | End user renting a unit | View rent info, make payments, submit maintenance requests |
| **Landlord** | Property owner | Manage properties (direct or via agency), view earnings |

## 🚀 Getting Started

### Prerequisites

- Go 1.21 or higher
- PostgreSQL 12 or higher
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd payrents/backend
   ```

2. **Install dependencies**
   ```bash
   go mod tidy
   ```

3. **Setup PostgreSQL database**
   ```sql
   CREATE DATABASE payrents_db;
   CREATE USER payrents_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE payrents_db TO payrents_user;
   ```

4. **Configure environment variables**
   
   Copy `.env` and update with your settings:
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=payrents_user
   DB_PASSWORD=your_password
   DB_NAME=payrents_db
   DB_SSLMODE=disable
   
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRATION_HOURS=24
   
   SERVER_PORT=8080
   SERVER_HOST=localhost
   
   ENV=development
   ```

5. **Run the server**
   ```bash
   go run cmd/server/main.go
   ```

   Or build and run:
   ```bash
   go build -o server cmd/server/main.go
   ./server
   ```

## 📡 API Endpoints

### Base URL
```
http://localhost:8080/api/v1
```

### Health Check
```http
GET /health
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/refresh` | Refresh access token | ❌ |
| POST | `/auth/logout` | User logout | ❌ |
| POST | `/auth/reset-password` | Request password reset | ❌ |
| POST | `/auth/reset-password/confirm` | Confirm password reset | ❌ |

### User Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/users/me` | Get current user profile | ✅ | All |
| PUT | `/users/me` | Update current user profile | ✅ | All |
| PUT | `/users/me/password` | Change password | ✅ | All |
| POST | `/users` | Create new user | ✅ | Admin+ |
| GET | `/users` | Get users list | ✅ | Admin+ |
| GET | `/users/{id}` | Get user by ID | ✅ | Admin+ |
| PUT | `/users/{id}` | Update user | ✅ | Admin+ |
| DELETE | `/users/{id}` | Delete user | ✅ | Admin+ |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/admin/users` | Get all platform users | ✅ | Super Admin |
| PUT | `/admin/users/{id}/activate` | Activate user | ✅ | Super Admin |
| PUT | `/admin/users/{id}/deactivate` | Deactivate user | ✅ | Super Admin |

### Agency Management

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/agency/users` | Get agency users | ✅ | Agency Admin+ |
| POST | `/agency/users` | Create agency user | ✅ | Agency Admin+ |

## 🗄️ Database Schema

### Key Tables

- **users** - All platform users with role-based access
- **agencies** - Property management agencies
- **refresh_tokens** - JWT refresh token storage
- **password_reset_tokens** - Password reset token storage
- **user_sessions** - Active user session tracking
- **user_permissions** - Granular permission management

### Sample Data

The database migration includes:

- **Super Admin User**
  - Email: `admin@payrents.com`
  - Password: `admin123!` (change in production)
  - Role: `super_admin`

- **Sample Agencies**
  - Prime Properties Agency
  - Urban Homes Management

## 🔐 Authentication & Security

### JWT Authentication
- **Access Token**: Short-lived (24 hours default)
- **Refresh Token**: Long-lived (30 days) for token renewal
- **Password Hashing**: bcrypt with salt

### Security Features
- Role-based access control (RBAC)
- Session management and tracking
- Password reset with secure tokens
- CORS protection
- Request validation and sanitization

## 🧪 Testing

### API Testing with curl

1. **Health Check**
   ```bash
   curl http://localhost:8080/api/v1/health
   ```

2. **Login (using default super admin)**
   ```bash
   curl -X POST http://localhost:8080/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@payrents.com","password":"admin123!"}'
   ```

3. **Access Protected Endpoint**
   ```bash
   curl http://localhost:8080/api/v1/users/me \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

## 🛠️ Development

### Code Structure
- **Domain Layer**: Business entities and rules
- **Port Layer**: Repository interfaces (dependency inversion)
- **Infrastructure Layer**: Database implementations
- **API Layer**: HTTP handlers and middleware

### Adding New Features
1. Define domain models in `internal/core/domain/`
2. Create repository interfaces in `internal/core/port/`
3. Implement repositories in `internal/db/postgres/`
4. Create business services in `internal/core/service/`
5. Add HTTP handlers in `internal/api/handler/`
6. Define routes in `internal/api/routes/`

## 🚀 Production Deployment

### Environment Configuration
- Set `ENV=production`
- Use strong JWT secrets
- Configure proper database credentials
- Set up HTTPS/TLS
- Configure CORS for your frontend domain

### Database Migration
The server automatically runs migrations on startup. For production:
```bash
# Run migration manually
psql -h hostname -U username -d database -f internal/db/migration/schema.sql
```

## 📝 API Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ },
  "error": null,
  "meta": { /* pagination info */ }
}
```

## 🤝 Contributing

1. Follow clean architecture principles
2. Add comprehensive tests
3. Document new endpoints
4. Use conventional commit messages
5. Update this README for significant changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the African real estate ecosystem** 