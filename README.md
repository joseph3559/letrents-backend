# LetRents Backend v2 (Node.js)

A complete Node.js/TypeScript backend for the LetRents Property Management System, migrated from Go with full feature parity.

## 🚀 Features

### Core Functionality
- **Authentication & Authorization**: JWT-based auth with RBAC and multi-tenancy
- **Property Management**: Complete CRUD with analytics and filtering
- **Unit Management**: Advanced unit operations with tenant assignment
- **Tenant Management**: Full lifecycle management with lease tracking
- **Maintenance Requests**: Request tracking and status management
- **Invoice Management**: Billing and payment tracking
- **Dashboard Analytics**: Real-time statistics and KPIs

### Technical Features
- **TypeScript**: Full type safety and modern JavaScript features
- **Prisma ORM**: Type-safe database operations with PostgreSQL
- **Express.js**: Fast, unopinionated web framework
- **Email Service**: Multi-provider email system (Brevo/SendGrid) with templating
- **RBAC**: Role-based access control with granular permissions
- **Multi-tenancy**: Company-scoped data isolation
- **API Documentation**: Swagger/OpenAPI documentation at `/docs`
- **Testing**: Jest + Supertest for comprehensive API testing
- **ESM**: Modern ECMAScript modules support

## 📋 Prerequisites

- Node.js 18+ (recommended: 20+)
- PostgreSQL 12+
- npm or yarn package manager

## 🛠️ Installation

1. **Clone and navigate to the project:**
   ```bash
   cd "/home/scott/Desktop/Office/letrents/backend v2"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and other settings
   ```

4. **Set up the database:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations (if you have them)
   npx prisma migrate deploy
   
   # Or push the schema directly
   npx prisma db push
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

6. **Start the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/letrents"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRATION_HOURS=24

# Server
PORT=8080
HOST=0.0.0.0
NODE_ENV=development

# Email Configuration
EMAIL_PROVIDER="brevo"  # Options: brevo, sendgrid
# Brevo (Primary)
BREVO_API_KEY="your-brevo-api-key"
# SendGrid (Alternative)
SENDGRID_API_KEY="your-sendgrid-api-key"
EMAIL_FROM_ADDRESS="noreply@letrents.com"
EMAIL_FROM_NAME="LetRents"

# ImageKit (for file uploads)
IMAGEKIT_PUBLIC_KEY="your-imagekit-public-key"
IMAGEKIT_PRIVATE_KEY="your-imagekit-private-key"
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/your-id"

# App URLs
APP_URL="http://localhost:3000"
API_URL="http://localhost:8080"
```

## 📚 API Documentation

### Base URL
```
http://localhost:8080/api/v1
```

### Interactive Documentation
Visit `http://localhost:8080/docs` for interactive Swagger UI documentation.

### Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/me` - Get current user info

#### Properties
- `GET /properties` - List properties with filtering
- `POST /properties` - Create new property
- `GET /properties/:id` - Get property details
- `PUT /properties/:id` - Update property
- `DELETE /properties/:id` - Delete property
- `GET /properties/:id/analytics` - Property analytics

#### Units
- `GET /units` - List units with advanced filtering
- `POST /units` - Create new unit
- `POST /units/batch` - Create multiple units
- `GET /units/available` - Search available units (public)
- `GET /units/:id` - Get unit details
- `PUT /units/:id` - Update unit
- `DELETE /units/:id` - Delete unit
- `PATCH /units/:id/status` - Update unit status
- `POST /units/:id/assign-tenant` - Assign tenant to unit
- `POST /units/:id/release-tenant` - Release tenant from unit

#### Tenants
- `GET /tenants` - List tenants with filtering
- `POST /tenants` - Create new tenant
- `GET /tenants/:id` - Get tenant details
- `PUT /tenants/:id` - Update tenant
- `DELETE /tenants/:id` - Delete tenant
- `POST /tenants/:id/assign-unit` - Assign unit to tenant
- `POST /tenants/:id/release-unit` - Release tenant from unit
- `POST /tenants/:id/terminate` - Terminate tenant
- `POST /tenants/:id/invite` - Send invitation
- `POST /tenants/:id/reset-password` - Reset password

#### Maintenance
- `GET /maintenance/requests` - List maintenance requests
- `POST /maintenance/requests` - Create maintenance request
- `GET /maintenance/requests/:id` - Get request details
- `PUT /maintenance/requests/:id` - Update request
- `DELETE /maintenance/requests/:id` - Delete request

#### Invoices
- `GET /invoices` - List invoices with filtering
- `POST /invoices` - Create new invoice
- `GET /invoices/:id` - Get invoice details
- `PUT /invoices/:id` - Update invoice
- `DELETE /invoices/:id` - Delete invoice

#### Dashboard
- `GET /dashboard/stats` - Get dashboard statistics
- `GET /dashboard/onboarding/status` - Get onboarding progress

#### Utility
- `GET /health` - Health check endpoint

## 🔐 Role-Based Access Control (RBAC)

The system supports the following user roles with specific permissions:

### Roles
- **super_admin**: Full system access
- **agency_admin**: Manage agency properties and users
- **landlord**: Manage own properties and tenants
- **agent**: Limited property and tenant access
- **caretaker**: Maintenance and basic property access
- **tenant**: View own information and unit details

### Resources & Actions
Each role has specific permissions for resources like:
- **properties**: create, read, update, delete, analytics
- **units**: create, read, update, delete, assign, release, status
- **tenants**: create, read, update, delete, assign, release
- **maintenance**: create, read, update, delete
- **invoices**: create, read, update, delete
- **dashboard**: read

## 🏗️ Project Structure

```
src/
├── config/          # Configuration files (env, prisma, etc.)
├── controllers/     # Route handlers
├── middleware/      # Authentication, RBAC, validation
├── routes/          # API route definitions
├── services/        # Business logic layer
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point

prisma/
├── schema.prisma    # Database schema
└── migrations/      # Database migrations

tests/
├── auth.test.ts     # Authentication tests
└── ...              # Other test files

docs/
└── swagger.yaml     # API documentation
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories
- **Authentication Tests**: Login, registration, JWT validation
- **API Endpoint Tests**: CRUD operations for all resources
- **RBAC Tests**: Permission validation
- **Integration Tests**: End-to-end workflows

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker (Optional)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

### Environment-Specific Configurations
- **Development**: Hot reloading with nodemon
- **Production**: Compiled JavaScript with PM2 or similar process manager
- **Testing**: In-memory database or test-specific database

## 📊 Performance & Monitoring

### Database Optimization
- Prisma query optimization
- Database indexing on frequently queried fields
- Connection pooling

### Logging
- Structured logging with Pino
- Request/response logging
- Error tracking and monitoring

### Security
- JWT token validation
- Input sanitization
- Rate limiting (can be added)
- CORS configuration
- Helmet.js security headers

## 🔄 Migration from Go Backend

This Node.js backend is a complete migration from the original Go backend with:

### ✅ Feature Parity
- All API endpoints migrated
- Same request/response formats
- Identical business logic
- Same database schema
- Matching error handling

### ✅ Improvements
- TypeScript type safety
- Modern JavaScript features
- Better development experience
- Enhanced testing capabilities
- Improved documentation

### 🔄 Migration Process
1. **Schema Migration**: Prisma introspection from existing PostgreSQL database
2. **API Migration**: Endpoint-by-endpoint migration with identical functionality
3. **Business Logic**: Preserved all validation rules and workflows
4. **Security**: Maintained RBAC and multi-tenancy features
5. **Testing**: Comprehensive test coverage for all endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow existing code style
- Ensure all tests pass

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the API documentation at `/docs`
- Review the test files for usage examples
- Open an issue for bugs or feature requests

## 📈 Roadmap

### Completed ✅
- Complete API migration from Go backend
- Authentication and authorization
- All core CRUD operations
- RBAC implementation
- Multi-tenancy support
- Dashboard analytics
- API documentation

### Future Enhancements 🔮
- Real-time notifications with WebSockets
- Advanced reporting and analytics
- File upload handling with ImageKit
- Email notifications with SendGrid
- Payment processing integration
- Mobile API optimizations
- Advanced caching strategies

---

**LetRents Backend v2** - Built with ❤️ using Node.js, TypeScript, and modern web technologies.
