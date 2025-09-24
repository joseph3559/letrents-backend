import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { SchedulerService } from './services/scheduler.service.js';

const port = env.port;

// Initialize scheduler service
const scheduler = SchedulerService.getInstance();

app.listen(port, env.host, () => {
	logger.info({ port, host: env.host }, 'Server started');
	
	// Start scheduled tasks only in production
	if (env.nodeEnv === 'production') {
		console.log('🕒 Starting scheduled tasks for production...');
		scheduler.initializeScheduledTasks();
	} else {
		console.log('⏸️ Scheduled tasks disabled in development mode');
	}
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('📴 SIGTERM received, shutting down gracefully...');
	scheduler.stopAllTasks();
	process.exit(0);
});

process.on('SIGINT', () => {
	console.log('📴 SIGINT received, shutting down gracefully...');
	scheduler.stopAllTasks();
	process.exit(0);
});
