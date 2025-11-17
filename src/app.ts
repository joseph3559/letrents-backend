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

// Configure Helmet with proper CORS headers support
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - allow all origins in development/dev, restrict in production
const isDev = process.env.NODE_ENV !== 'production' || 
              (process.env.API_URL && process.env.API_URL.includes('dev')) ||
              (process.env.HOST && process.env.HOST.includes('dev'));

app.use(cors({
  origin: isDev 
    ? true // Allow all origins in dev/development
    : (origin, callback) => {
        // In production, check against allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
        // Also allow dev origins if they exist in the list
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`⚠️ CORS: Blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'user-email', // Custom header used by frontend
    'User-Email', // Support both cases
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
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
		const swaggerSpec = yaml.load(swaggerDocument) as any;
		
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
	} else {
		console.warn('⚠️  Swagger documentation file not found at:', swaggerPath);
	}
} catch (error) {
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
