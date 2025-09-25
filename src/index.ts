import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
// import { SchedulerService } from './services/scheduler.service.js';

const port = env.port;

// TODO: Fix scheduler service
// const scheduler = SchedulerService.getInstance();

app.listen(port, env.host, () => {
	logger.info({ port, host: env.host }, 'Server started');
	console.log('🚀 Backend server is running!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('📴 SIGTERM received, shutting down gracefully...');
	process.exit(0);
});

process.on('SIGINT', () => {
	console.log('📴 SIGINT received, shutting down gracefully...');
	process.exit(0);
});
