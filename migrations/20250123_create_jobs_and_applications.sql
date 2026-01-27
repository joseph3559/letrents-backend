-- Migration: Create Jobs and Job Applications tables
-- Created: 2025-01-23

-- Create JobPosting table
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    location VARCHAR(255),
    employment_type VARCHAR(50), -- full_time, part_time, contract, internship
    description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    salary_range VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, closed
    application_deadline TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    views_count INTEGER DEFAULT 0,
    applications_count INTEGER DEFAULT 0
);

-- Create JobApplication table
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    cover_letter TEXT,
    resume_url VARCHAR(500),
    linkedin_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    years_of_experience INTEGER,
    current_position VARCHAR(255),
    current_company VARCHAR(255),
    expected_salary VARCHAR(100),
    availability_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewing, shortlisted, rejected, hired
    notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create FAQ table for marketing management
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON job_postings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_posting_id ON job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faqs_published ON faqs(is_published);
CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs(order_index);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON faqs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to tables
COMMENT ON TABLE job_postings IS 'Stores job postings for the careers page';
COMMENT ON TABLE job_applications IS 'Stores job applications submitted by candidates';
COMMENT ON TABLE faqs IS 'Stores frequently asked questions for the marketing section';
