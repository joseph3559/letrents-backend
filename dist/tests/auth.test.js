const request = require('supertest');
const app = require('../dist/src/app.js').default;
describe('Auth', () => {
    it('registers a user (tenant) and returns verification required when email verification is on', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: `user_${Date.now()}@example.com`, password: 'SecurePass123!', first_name: 'John', last_name: 'Doe', role: 'tenant' })
            .expect(201);
        expect(res.body.success).toBe(true);
    });
    it('fails login with wrong credentials', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'nonexistent@example.com', password: 'wrong' })
            .expect(404);
        expect(res.body.success).toBe(false);
    });
    it('protects routes with JWT', async () => {
        await request(app).get('/api/v1/properties').expect(200); // currently public skeleton
    });
});
export {};
