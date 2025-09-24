import pino from 'pino';
const isDev = process.env.NODE_ENV !== 'production';
export const logger = pino(isDev
    ? {
        level: 'debug',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
        },
    }
    : { level: 'info' });
