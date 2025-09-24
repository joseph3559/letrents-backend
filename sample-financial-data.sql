-- Sample financial data for property 9d56d054-478c-4723-a3f8-8fb6e5ae4412

-- First, let's get some tenant and unit IDs
-- You can run: SELECT id, first_name, last_name FROM users WHERE role = 'tenant' LIMIT 3;
-- You can run: SELECT id, unit_number FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 3;

-- Sample payments (adjust the tenant_id and unit_id based on your actual data)
INSERT INTO payments (
    id, company_id, tenant_id, unit_id, property_id, amount, currency, 
    payment_method, payment_type, status, payment_date, payment_period, 
    receipt_number, transaction_id, notes, created_by, created_at, updated_at
) VALUES 
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    25000.00,
    'KES',
    'mpesa',
    'rent',
    'completed',
    '2024-01-15',
    'January 2024',
    'RCP-2024-001',
    'TXN123456789',
    'Monthly rent payment for January 2024',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    NOW(),
    NOW()
),
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    27000.00,
    'KES',
    'bank_transfer',
    'rent',
    'completed',
    '2024-02-10',
    'February 2024',
    'RCP-2024-002',
    'TXN123456790',
    'Monthly rent payment for February 2024',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    NOW(),
    NOW()
),
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    5000.00,
    'KES',
    'mpesa',
    'utility',
    'completed',
    '2024-01-20',
    'January 2024',
    'RCP-2024-003',
    'TXN123456791',
    'Electricity bill payment',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    NOW(),
    NOW()
),
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    3500.00,
    'KES',
    'cash',
    'utility',
    'completed',
    '2024-02-15',
    'February 2024',
    'RCP-2024-004',
    NULL,
    'Water bill payment',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    NOW(),
    NOW()
),
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    25000.00,
    'KES',
    'mpesa',
    'rent',
    'completed',
    '2024-03-12',
    'March 2024',
    'RCP-2024-005',
    'TXN123456792',
    'Monthly rent payment for March 2024',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    NOW(),
    NOW()
);

-- Sample invoices for outstanding balance
INSERT INTO invoices (
    id, company_id, invoice_number, title, description, invoice_type,
    issued_by, issued_to, property_id, unit_id, subtotal, tax_amount,
    discount_amount, total_amount, currency, issue_date, due_date,
    status, created_at, updated_at
) VALUES
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    'INV-2024-001',
    'April 2024 Rent',
    'Monthly rent for April 2024',
    'rent',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    25000.00,
    0.00,
    0.00,
    25000.00,
    'KES',
    '2024-04-01',
    '2024-04-05',
    'pending',
    NOW(),
    NOW()
),
(
    uuid_generate_v4(),
    '594e5cb5-ba6d-4311-9c99-733e8cddcf47',
    'INV-2024-002',
    'May 2024 Rent',
    'Monthly rent for May 2024',
    'rent',
    '0b46a69d-3a0b-4b6f-9c39-b311f111488b',
    (SELECT id FROM users WHERE role = 'tenant' AND company_id = '594e5cb5-ba6d-4311-9c99-733e8cddcf47' LIMIT 1),
    '9d56d054-478c-4723-a3f8-8fb6e5ae4412',
    (SELECT id FROM units WHERE property_id = '9d56d054-478c-4723-a3f8-8fb6e5ae4412' LIMIT 1),
    25000.00,
    0.00,
    0.00,
    25000.00,
    'KES',
    '2024-05-01',
    '2024-05-05',
    'overdue',
    NOW(),
    NOW()
);

-- You can run this script in your PostgreSQL database to add sample financial data
-- Then test the endpoints:
-- GET /api/v1/properties/9d56d054-478c-4723-a3f8-8fb6e5ae4412/payments
-- GET /api/v1/properties/9d56d054-478c-4723-a3f8-8fb6e5ae4412/utility-bills
-- GET /api/v1/properties/9d56d054-478c-4723-a3f8-8fb6e5ae4412/outstanding-balance
