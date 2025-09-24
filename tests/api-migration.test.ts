import request from 'supertest';
import app from '../src/app.js';

describe('API Migration Tests', () => {
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

  describe('Route Aliases', () => {
    test('should redirect /super-admin/dashboard to /dashboard', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/dashboard')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-route-aliased']).toBe('true');
      expect(response.headers['x-original-route']).toBe('/super-admin/dashboard');
      expect(response.headers['x-unified-route']).toBe('/dashboard');
    });

    test('should redirect /agency-admin/properties to /properties', async () => {
      const response = await request(app)
        .get('/api/v1/agency-admin/properties')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-route-aliased']).toBe('true');
      expect(response.headers['x-original-route']).toBe('/agency-admin/properties');
      expect(response.headers['x-unified-route']).toBe('/properties');
    });

    test('should redirect /landlord/caretakers to /caretakers', async () => {
      const response = await request(app)
        .get('/api/v1/landlord/caretakers')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-route-aliased']).toBe('true');
      expect(response.headers['x-original-route']).toBe('/landlord/caretakers');
      expect(response.headers['x-unified-route']).toBe('/caretakers');
    });
  });

  describe('Deprecation Warnings', () => {
    test('should include deprecation warning headers for legacy routes', async () => {
      const response = await request(app)
        .get('/api/v1/super-admin/users')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-api-deprecation-warning']).toBeDefined();
      expect(response.headers['x-api-migration-guide']).toBe('https://docs.letrents.com/api/migration-guide');
    });

    test('should not include deprecation warnings for unified routes', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-api-deprecation-warning']).toBeUndefined();
      expect(response.headers['x-route-aliased']).toBeUndefined();
    });
  });

  describe('Unified API Endpoints', () => {
    test('should handle unified dashboard endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${mockToken}`);

      // Should not have alias headers since it's a unified endpoint
      expect(response.headers['x-route-aliased']).toBeUndefined();
    });

    test('should handle unified properties endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/properties')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-route-aliased']).toBeUndefined();
    });

    test('should handle unified tenants endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/tenants')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.headers['x-route-aliased']).toBeUndefined();
    });
  });

  describe('Leases API', () => {
    test('should handle leases listing endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/leases')
        .set('Authorization', `Bearer ${mockToken}`);

      // Should be accessible via unified API
      expect(response.status).not.toBe(404);
    });

    test('should handle lease creation endpoint', async () => {
      const leaseData = {
        tenant_id: 'test-tenant-id',
        unit_id: 'test-unit-id',
        property_id: 'test-property-id',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        rent_amount: 1500,
        deposit_amount: 3000,
      };

      const response = await request(app)
        .post('/api/v1/leases')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(leaseData);

      // Should accept the request structure
      expect(response.status).not.toBe(404);
    });

    test('should handle lease utility endpoints', async () => {
      const endpoints = [
        '/api/v1/leases/expiring/list',
        '/api/v1/leases/unit/test-unit-id/history',
        '/api/v1/leases/tenant/test-tenant-id/leases',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).not.toBe(404);
      }
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Migration Status', () => {
    test('should return migration test endpoint', async () => {
      const response = await request(app).get('/api/v1/migration/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unified API structure');
    });
  });
});

// Database Schema Tests (would require actual database connection)
describe('Database Schema Validation', () => {
  test.skip('should have tenant_profiles with current_property_id column', async () => {
    // This would test the actual database schema
    // Skipped for now as it requires database connection
  });

  test.skip('should have leases table with proper structure', async () => {
    // This would test the leases table creation
    // Skipped for now as it requires database connection
  });

  test.skip('should have proper indexes on tenant relationships', async () => {
    // This would test index creation
    // Skipped for now as it requires database connection
  });
});

export {};
