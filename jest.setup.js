// Jest setup file to configure test environment
process.env.NODE_ENV = 'test';

// Set default test environment variables if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
}
// Email service will use test mode (no actual emails sent)
if (!process.env.BREVO_API_KEY) {
  process.env.BREVO_API_KEY = '';
}
if (!process.env.EMAIL_PROVIDER) {
  process.env.EMAIL_PROVIDER = 'brevo';
}

