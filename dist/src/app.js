import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { env } from './config/env.js';
import { errorHandler } from './utils/response.js';
import routes from './routes/index.js';
import { routeAliasMiddleware, deprecationWarningMiddleware } from './middleware/route-aliases.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(helmet());
// CORS configuration - allow all origins in development, restrict in production
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
// Route aliases for backward compatibility
app.use('/api/v1', routeAliasMiddleware);
app.use('/api/v1', deprecationWarningMiddleware);
// Health & Status Endpoints
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'letrents-backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.nodeEnv,
    });
});
app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'Service is healthy',
        data: {
            status: 'healthy',
            service: 'letrents-backend',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: env.nodeEnv,
        },
    });
});
// Root endpoint
app.get('/', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'LetRents Property Management API',
        data: {
            service: 'letrents-backend',
            version: '2.0.0',
            status: 'running',
            documentation: '/docs',
            health: '/health',
            api: '/api/v1',
        },
    });
});
app.get('/api/v1', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'LetRents Property Management API v1',
        data: {
            version: '1.0.0',
            endpoints: {
                health: '/api/v1/health',
                auth: '/api/v1/auth',
                properties: '/api/v1/properties',
                units: '/api/v1/units',
                tenants: '/api/v1/tenants',
                payments: '/api/v1/payments',
                invoices: '/api/v1/invoices',
                maintenance: '/api/v1/maintenance',
                reports: '/api/v1/reports',
            },
            documentation: '/docs',
        },
    });
});
// Swagger Documentation Setup
try {
    const swaggerPath = path.resolve(__dirname, '../../docs/swagger.yaml');
    if (fs.existsSync(swaggerPath)) {
        const swaggerDocument = fs.readFileSync(swaggerPath, 'utf-8');
        const swaggerSpec = yaml.load(swaggerDocument);
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'LetRents API Documentation',
            customfavIcon: '/favicon.ico',
        }));
        // Also serve raw YAML
        app.get('/swagger.yaml', (_req, res) => {
            res.type('yaml').send(swaggerDocument);
        });
        // Serve JSON version
        app.get('/swagger.json', (_req, res) => {
            res.json(swaggerSpec);
        });
        console.log('✅ Swagger documentation loaded successfully');
    }
    else {
        console.warn('⚠️  Swagger documentation file not found at:', swaggerPath);
    }
}
catch (error) {
    console.error('❌ Error setting up Swagger documentation:', error);
}
// API request logging (development only)
if (process.env.NODE_ENV === 'development') {
    app.use('/api/v1', (req, res, next) => {
        console.log(`🌍 ${req.method} ${req.path}`);
        next();
    });
}
// API routes
app.use('/api/v1', routes);
// 404 Handler - Must be before error handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found',
        error: {
            code: 'NOT_FOUND',
            path: req.path,
            method: req.method,
            suggestion: 'Check the API documentation at /docs for available endpoints',
        },
    });
});
// Global Error handler - Must be last
app.use(errorHandler);
export default app;
