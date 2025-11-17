import * as dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, name: string): string => {
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
};

export const env = {
	nodeEnv: process.env.NODE_ENV || 'development',
	host: process.env.HOST || '0.0.0.0',
	port: Number(process.env.PORT || 8080),
	databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
	jwt: {
		secret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
		expHours: Number(process.env.JWT_EXPIRATION_HOURS || 24),
		refreshExpHours: Number(process.env.JWT_REFRESH_EXPIRATION_HOURS || 168),
		issuer: process.env.JWT_ISSUER || 'pay-rents-api',
		audience: process.env.JWT_AUDIENCE || 'pay-rents-app',
	},
	security: {
		maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
		accountLockDurationMins: Number(process.env.ACCOUNT_LOCK_DURATION_MINS || 30),
		requireEmailVerification: (process.env.REQUIRE_EMAIL_VERIFICATION ?? 'true') === 'true',
		passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH || 8),
		passwordRequireSpecial: (process.env.PASSWORD_REQUIRE_SPECIAL ?? 'true') === 'true',
		passwordRequireNumber: (process.env.PASSWORD_REQUIRE_NUMBER ?? 'true') === 'true',
		passwordRequireUpper: (process.env.PASSWORD_REQUIRE_UPPER ?? 'true') === 'true',
		sessionTimeoutHours: Number(process.env.SESSION_TIMEOUT_HOURS || 8),
	},
	appUrl: process.env.APP_URL || 'http://localhost:3000',
	apiUrl: process.env.API_URL || 'http://localhost:8080',
	imagekit: {
		privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
		publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
		endpoint: process.env.IMAGEKIT_ENDPOINT_URL || '',
	},
	email: {
		provider: process.env.EMAIL_PROVIDER || 'brevo', // 'brevo' or 'sendgrid'
		sendgridKey: process.env.SENDGRID_API_KEY || '',
		brevoKey: process.env.BREVO_API_KEY || '',
		fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@letrents.com',
		fromName: process.env.EMAIL_FROM_NAME || 'LetRents',
	},
	slack: {
		devSignupWebhookUrl: process.env.SLACK_DEV_SIGNUP_WEBHOOK_URL || '',
		prodSignupWebhookUrl: process.env.SLACK_PROD_SIGNUP_WEBHOOK_URL || '',
	},
};
