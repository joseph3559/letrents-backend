import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const port = env.port;

app.listen(port, env.host, () => {
	logger.info({ port, host: env.host }, 'Server started');
});
