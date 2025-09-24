import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { errorHandler } from './utils/response.js';
import routes from './routes/index.js';
import { routeAliasMiddleware, deprecationWarningMiddleware } from './middleware/route-aliases.js';
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
// Route aliases for backward compatibility
app.use('/api/v1', routeAliasMiddleware);
app.use('/api/v1', deprecationWarningMiddleware);
// Health
app.get('/api/v1/health', (_req, res) => res.json({ success: true, message: 'Service is healthy', data: { status: 'healthy', service: 'letrents-backend-v2', version: '1.0.0' } }));
// Swagger (serve existing YAML from Go backend)
try {
    const swaggerPath = path.resolve('/home/scott/Desktop/Office/letrents/backend/swagger.yaml');
    if (fs.existsSync(swaggerPath)) {
        const swaggerDocument = fs.readFileSync(swaggerPath, 'utf-8');
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/swagger.yaml' }));
        app.get('/swagger.yaml', (_req, res) => {
            res.type('yaml').send(swaggerDocument);
        });
    }
}
catch (_) { }
// API routes
app.use('/api/v1', routes);
// Error handler
app.use(errorHandler);
export default app;
