-- Demo Data Seeding Script for LetRents Backend
-- This script adds demo data for development and testing purposes
-- Password for all demo users: demo123!
-- Hash: $2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2

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
);

-- Insert demo users with various roles
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
-- Demo test users for quick access (matching the login handler)
(
    'demo0001-e89b-12d3-a456-426614174001',
    'agency@demo.com',
    '$2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Agency',
    'Admin',
    '+254700000001',
    'agency_admin',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
),
(
    'demo0002-e89b-12d3-a456-426614174002',
    'landlord@demo.com',
    '$2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'John',
    'Landlord',
    '+254700000002',
    'landlord',
    'active',
    NULL,
    (SELECT id FROM users WHERE email = 'admin@letrents.com'),
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    'demo0003-e89b-12d3-a456-426614174003',
    'agent@demo.com',
    '$2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Jane',
    'Agent',
    '+254700000003',
    'agent',
    'active',
    'a1234567-e89b-12d3-a456-426614174001',
    'demo0001-e89b-12d3-a456-426614174001',
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
),
(
    'demo0004-e89b-12d3-a456-426614174004',
    'tenant@demo.com',
    '$2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    'Bob',
    'Tenant',
    '+254700000004',
    'tenant',
    'active',
    NULL,
    'demo0003-e89b-12d3-a456-426614174003',
    CURRENT_TIMESTAMP - INTERVAL '1 month',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP - INTERVAL '4 hours'
);

-- Update the existing super admin password hash to match demo password  
UPDATE users 
SET password_hash = '$2a$10$rEFGwuZqJxqgLhL0vCr4WOWGm6QMT4oZmjZJvQMBv7x2GUaOnKzq2',
    last_login_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes'
WHERE email = 'admin@letrents.com';

-- Display summary of seeded data
SELECT 
    'DEMO DATA SEEDING COMPLETED' as status,
    (SELECT COUNT(*) FROM agencies) as agencies_count,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM users WHERE role = 'super_admin') as super_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'agency_admin') as agency_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'agent') as agents,
    (SELECT COUNT(*) FROM users WHERE role = 'landlord') as landlords,
    (SELECT COUNT(*) FROM users WHERE role = 'tenant') as tenants;

-- Show demo login credentials
SELECT 
    'DEMO LOGIN CREDENTIALS - Password: demo123!' as info;

SELECT 
    email,
    first_name || ' ' || last_name as full_name,
    role,
    status
FROM users 
ORDER BY role, email; 