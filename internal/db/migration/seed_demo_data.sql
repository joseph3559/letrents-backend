-- Demo Data Seeding Script for LetRents Backend
-- This script adds demo data for development and testing purposes
-- Password hashes are for 'demo123!' using bcrypt

-- Clear existing demo data (except super admin)
DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users WHERE email = 'admin@letrents.com');
DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users WHERE email = 'admin@letrents.com');
DELETE FROM users WHERE email != 'admin@letrents.com';
DELETE FROM agencies WHERE email != 'system@letrents.com';

-- Insert demo agencies first
INSERT INTO agencies (
    id,
    name,
    email,
    phone_number,
    address,
    status,
    created_by,
    created_at,
    updated_at
) VALUES 
(
    'a1234567-e89b-12d3-a456-426614174001',
    'Prime Properties Kenya',
    'admin@primeproperties.co.ke',
    '+254700123456',
    'Westlands Business District, Nairobi',
    'active',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '6 months',
    CURRENT_TIMESTAMP
),
(
    'a1234567-e89b-12d3-a456-426614174002',
    'Urban Homes Management',
    'contact@urbanhomes.co.ke',
    '+254701234567',
    'Karen Shopping Centre, Nairobi',
    'active',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '4 months',
    CURRENT_TIMESTAMP
),
(
    'a1234567-e89b-12d3-a456-426614174003',
    'Skyline Realty',
    'info@skylinerealty.co.ke',
    '+254702345678',
    'Upper Hill, Nairobi',
    'active',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '2 months',
    CURRENT_TIMESTAMP
),
(
    'a1234567-e89b-12d3-a456-426614174004',
    'Sunset Properties (Suspended)',
    'support@sunsetproperties.co.ke',
    '+254703456789',
    'Kilimani, Nairobi',
    'suspended',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '8 months',
    CURRENT_TIMESTAMP
);

-- Insert demo users with various roles
-- Password for all demo users: demo123!
-- Hash: $2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2

INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    phone_number,
    role,
    status,
    agency_id,
    created_by,
    created_at,
    updated_at,
    last_login_at
) VALUES 
-- Agency Admin Users
(
    'u1234567-e89b-12d3-a456-426614174001',
    'admin@primeproperties.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'John',
    'Kariuki',
    '+254700123456',
    'agency_admin',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '6 months',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'u1234567-e89b-12d3-a456-426614174002',
    'manager@urbanhomes.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Sarah',
    'Mwangi',
    '+254701234567',
    'agency_admin',
    'active',
    'a1234567-e89b-12d3-a456-426614174002',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '4 months',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    'u1234567-e89b-12d3-a456-426614174003',
    'director@skylinerealty.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Michael',
    'Ochieng',
    '+254702345678',
    'agency_admin',
    'active',
    'a1234567-e89b-12d3-a456-426614174003',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '2 months',
    CURRENT_TIMESTAMP - INTERVAL '1 week',
    CURRENT_TIMESTAMP - INTERVAL '1 week'
),

-- Agent Users
(
    'u1234567-e89b-12d3-a456-426614174004',
    'agent1@primeproperties.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Grace',
    'Wanjiku',
    '+254704567890',
    'agent',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    'u1234567-e89b-12d3-a456-426614174001', -- Created by agency admin
    CURRENT_TIMESTAMP - INTERVAL '5 months',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
),
(
    'u1234567-e89b-12d3-a456-426614174005',
    'agent2@primeproperties.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Peter',
    'Kimani',
    '+254705678901',
    'agent',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    'u1234567-e89b-12d3-a456-426614174001',
    CURRENT_TIMESTAMP - INTERVAL '4 months',
    CURRENT_TIMESTAMP - INTERVAL '6 hours',
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
),
(
    'u1234567-e89b-12d3-a456-426614174006',
    'sales@urbanhomes.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Mary',
    'Njeri',
    '+254706789012',
    'agent',
    'active',
    'a1234567-e89b-12d3-a456-426614174002',
    'u1234567-e89b-12d3-a456-426614174002',
    CURRENT_TIMESTAMP - INTERVAL '3 months',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),

-- Independent Landlord Users
(
    'u1234567-e89b-12d3-a456-426614174007',
    'landlord@independent.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'David',
    'Mutua',
    '+254707890123',
    'landlord',
    'active',
    NULL, -- Independent landlord, no agency
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '7 months',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
),
(
    'u1234567-e89b-12d3-a456-426614174008',
    'property.owner@gmail.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Catherine',
    'Wangari',
    '+254708901234',
    'landlord',
    'active',
    NULL,
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '1 year',
    CURRENT_TIMESTAMP - INTERVAL '1 week',
    CURRENT_TIMESTAMP - INTERVAL '1 week'
),

-- Tenant Users
(
    'u1234567-e89b-12d3-a456-426614174009',
    'tenant1@example.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'James',
    'Muturi',
    '+254709012345',
    'tenant',
    'active',
    NULL,
    'u1234567-e89b-12d3-a456-426614174004', -- Created by agent
    CURRENT_TIMESTAMP - INTERVAL '3 months',
    CURRENT_TIMESTAMP - INTERVAL '5 hours',
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
),
(
    'u1234567-e89b-12d3-a456-426614174010',
    'resident@apartments.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Lucy',
    'Akinyi',
    '+254700012345',
    'tenant',
    'active',
    NULL,
    'u1234567-e89b-12d3-a456-426614174005',
    CURRENT_TIMESTAMP - INTERVAL '2 months',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    'u1234567-e89b-12d3-a456-426614174011',
    'john.tenant@email.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'John',
    'Otieno',
    '+254701012345',
    'tenant',
    'suspended',
    NULL,
    'u1234567-e89b-12d3-a456-426614174006',
    CURRENT_TIMESTAMP - INTERVAL '4 months',
    CURRENT_TIMESTAMP - INTERVAL '2 weeks',
    CURRENT_TIMESTAMP - INTERVAL '2 weeks'
),

-- Caretaker Users
(
    'u1234567-e89b-12d3-a456-426614174012',
    'caretaker@residences.co.ke',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Francis',
    'Kiptoo',
    '+254702012345',
    'caretaker',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    'u1234567-e89b-12d3-a456-426614174001',
    CURRENT_TIMESTAMP - INTERVAL '5 months',
    CURRENT_TIMESTAMP - INTERVAL '8 hours',
    CURRENT_TIMESTAMP - INTERVAL '8 hours'
),

-- Demo test users for quick access
(
    'demo0001-e89b-12d3-a456-426614174001',
    'agency@demo.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Agency',
    'Admin',
    '+254700000001',
    'agency_admin',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'demo0002-e89b-12d3-a456-426614174002',
    'landlord@demo.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'John',
    'Landlord',
    '+254700000002',
    'landlord',
    'active',
    NULL,
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'demo0003-e89b-12d3-a456-426614174003',
    'agent@demo.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Jane',
    'Agent',
    '+254700000003',
    'agent',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    'demo0001-e89b-12d3-a456-426614174001',
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'demo0004-e89b-12d3-a456-426614174004',
    'tenant@demo.com',
    '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Bob',
    'Tenant',
    '+254700000004',
    'tenant',
    'active',
    NULL,
    'demo0003-e89b-12d3-a456-426614174003',
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Update the existing super admin password hash to match demo password
UPDATE users 
SET password_hash = '$2a$10$8K6j8K6j8K6j8K6j8K6j8OWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    last_login_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes'
WHERE email = 'admin@letrents.com';

-- Insert some user permissions for testing RBAC
INSERT INTO user_permissions (user_id, permission, resource_type, resource_id, granted_by, created_at) VALUES
-- Give agency admin special permissions
('u1234567-e89b-12d3-a456-426614174001', 'super_manage_properties', 'agency', 'a1234567-e89b-12d3-a456-426614174001', 
 (SELECT id FROM users WHERE email = 'admin@letrents.com'), CURRENT_TIMESTAMP),
('u1234567-e89b-12d3-a456-426614174001', 'financial_reports', 'agency', 'a1234567-e89b-12d3-a456-426614174001',
 (SELECT id FROM users WHERE email = 'admin@letrents.com'), CURRENT_TIMESTAMP),

-- Give independent landlord special permissions  
('u1234567-e89b-12d3-a456-426614174007', 'advanced_analytics', NULL, NULL,
 (SELECT id FROM users WHERE email = 'admin@letrents.com'), CURRENT_TIMESTAMP);

-- Create some sample refresh tokens (for demo purposes)
INSERT INTO refresh_tokens (
    id,
    user_id,
    token_hash,
    ip_address,
    user_agent,
    expires_at,
    created_at,
    is_revoked
) VALUES
-- Super admin refresh token
(
    uuid_generate_v4(),
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    encode(sha256('demo-super-admin-refresh-token-2024'::bytea), 'hex'),
    '127.0.0.1',
    'Demo Browser/1.0',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    false
),
-- Agency admin refresh token
(
    uuid_generate_v4(),
    'u1234567-e89b-12d3-a456-426614174001',
    encode(sha256('demo-agency-admin-refresh-token-2024'::bytea), 'hex'),
    '192.168.1.100',
    'Demo Mobile App/2.0',
    CURRENT_TIMESTAMP + INTERVAL '30 days', 
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    false
);

-- Create sample user sessions
INSERT INTO user_sessions (
    id,
    user_id,
    session_token,
    ip_address,
    user_agent,
    last_activity,
    expires_at,
    created_at,
    is_active
) VALUES
-- Super admin active session
(
    uuid_generate_v4(),
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    encode(sha256('demo-super-admin-session-2024'::bytea), 'hex'),
    '127.0.0.1',
    'Demo Browser/1.0 (Development)',
    CURRENT_TIMESTAMP - INTERVAL '5 minutes',
    CURRENT_TIMESTAMP + INTERVAL '8 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    true
),
-- Agency admin active session
(
    uuid_generate_v4(),
    'u1234567-e89b-12d3-a456-426614174001',
    encode(sha256('demo-agency-admin-session-2024'::bytea), 'hex'),
    '192.168.1.100',
    'Demo Mobile App/2.0 (Android)',
    CURRENT_TIMESTAMP - INTERVAL '10 minutes',
    CURRENT_TIMESTAMP + INTERVAL '24 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    true
);

-- Insert some login attempt records for security monitoring
INSERT INTO login_attempts (
    email,
    phone_number,
    ip_address,
    user_agent,
    success,
    user_id,
    failure_reason,
    created_at
) VALUES
-- Successful logins
('admin@letrents.com', NULL, '127.0.0.1', 'Demo Browser/1.0', true, 
 (SELECT id FROM users WHERE email = 'admin@letrents.com'), NULL, CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
('admin@primeproperties.co.ke', NULL, '192.168.1.100', 'Demo Mobile App/2.0', true,
 'u1234567-e89b-12d3-a456-426614174001', NULL, CURRENT_TIMESTAMP - INTERVAL '2 hours'),

-- Failed login attempts  
('hacker@example.com', NULL, '10.0.0.5', 'Malicious Bot/1.0', false, NULL, 'invalid_credentials', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('admin@letrents.com', NULL, '192.168.1.200', 'Demo Browser/1.0', false,
 (SELECT id FROM users WHERE email = 'admin@letrents.com'), 'invalid_credentials', CURRENT_TIMESTAMP - INTERVAL '1 day'),

-- Phone login attempts
(NULL, '+254700123456', '192.168.1.150', 'Demo Mobile App/2.0', true,
 'u1234567-e89b-12d3-a456-426614174001', NULL, CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- Update statistics for better demo data visualization  
-- This would typically be done by triggers or scheduled jobs in production

ANALYZE users;
ANALYZE agencies;
ANALYZE refresh_tokens;
ANALYZE user_sessions;
ANALYZE login_attempts;

-- Display summary of seeded data
SELECT 
    'DEMO DATA SEEDING COMPLETED' as status,
    (SELECT COUNT(*) FROM agencies) as agencies_count,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM users WHERE role = 'super_admin') as super_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'agency_admin') as agency_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'agent') as agents,
    (SELECT COUNT(*) FROM users WHERE role = 'landlord') as landlords,
    (SELECT COUNT(*) FROM users WHERE role = 'tenant') as tenants,
    (SELECT COUNT(*) FROM users WHERE role = 'caretaker') as caretakers,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users;

-- Show demo login credentials
SELECT 
    'DEMO LOGIN CREDENTIALS' as info,
    'All passwords are: demo123!' as password_info;

SELECT 
    email,
    first_name || ' ' || last_name as full_name,
    role,
    status,
    CASE 
        WHEN agency_id IS NOT NULL THEN (SELECT name FROM agencies WHERE id = agency_id)
        ELSE 'Independent'
    END as agency_name
FROM users 
WHERE email LIKE '%demo.com' OR email = 'admin@letrents.com'
ORDER BY role, email; 