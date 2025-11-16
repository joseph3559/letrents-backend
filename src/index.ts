import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const port = env.port;

app.listen(port, env.host, () => {
	logger.info({ port, host: env.host }, 'Server started');
	
	console.log('\n╔════════════════════════════════════════════════════════════════╗');
	console.log('║                                                                ║');
	console.log('║        🏢 LetRents Property Management System v2.0.0          ║');
	console.log('║                                                                ║');
	console.log('╚════════════════════════════════════════════════════════════════╝\n');
	console.log(`✅ Server Status:        Running`);
	console.log(`🌐 Environment:         ${env.nodeEnv}`);
	console.log(`🔗 Server URL:          http://${env.host}:${port}`);
	console.log(`🏥 Health Check:        http://${env.host}:${port}/health`);
	console.log(`📚 API Documentation:   http://${env.host}:${port}/docs`);
	console.log(`📡 API Endpoint:        http://${env.host}:${port}/api/v1`);
	console.log(`⏰ Started at:          ${new Date().toLocaleString()}`);
	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	console.log('💡 Press Ctrl+C to stop the server\n');
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
