import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const prisma = new PrismaClient();

// ============================================================================
// JOB POSTINGS
// ============================================================================

export const getJobPostings = async (req: Request, res: Response) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    // Build WHERE clause for raw query
    let whereClause = '';
    const queryParams: any[] = [];

    if (status) {
      whereClause = `WHERE status = $1`;
      queryParams.push(String(status));
    }

    // Use Prisma's $queryRaw with template literals for better safety
    if (status) {
      const [jobs, total] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT 
            id, title, department, location, employment_type, 
            description, requirements, responsibilities, benefits, salary_range,
            status, application_deadline, posted_by, created_at, updated_at,
            published_at, views_count, applications_count
          FROM job_postings
          WHERE status = ${String(status)}
          ORDER BY created_at DESC
          LIMIT ${Number(limit)} OFFSET ${Number(offset)}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count 
          FROM job_postings
          WHERE status = ${String(status)}
        `
      ]);

      res.json({
        success: true,
        data: jobs || [],
        pagination: {
          total: Number((total as any[])[0]?.count || 0),
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } else {
      const [jobs, total] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT 
            id, title, department, location, employment_type, 
            description, requirements, responsibilities, benefits, salary_range,
            status, application_deadline, posted_by, created_at, updated_at,
            published_at, views_count, applications_count
          FROM job_postings
          ORDER BY created_at DESC
          LIMIT ${Number(limit)} OFFSET ${Number(offset)}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count 
          FROM job_postings
        `
      ]);

      res.json({
        success: true,
        data: jobs || [],
        pagination: {
          total: Number((total as any[])[0]?.count || 0),
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    }
  } catch (error: any) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job postings',
      error: error.message
    });
  }
};

export const getJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const job = await prisma.$queryRawUnsafe(
      `SELECT 
        id, title, department, location, employment_type, 
        description, requirements, responsibilities, benefits, salary_range,
        status, application_deadline, posted_by, created_at, updated_at,
        published_at, views_count, applications_count
      FROM job_postings
      WHERE id = $1::uuid`,
      id
    );

    if (!job || (job as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Increment views count
    await prisma.$executeRawUnsafe(
      `UPDATE job_postings 
      SET views_count = views_count + 1 
      WHERE id = $1::uuid`,
      id
    );

    res.json({
      success: true,
      data: (job as any[])[0]
    });
  } catch (error: any) {
    console.error('Error fetching job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job posting',
      error: error.message
    });
  }
};

export const createJobPosting = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      title,
      department,
      location,
      employment_type,
      description,
      requirements,
      responsibilities,
      benefits,
      salary_range,
      application_deadline,
      status = 'draft'
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const job = await prisma.$queryRaw`
      INSERT INTO job_postings (
        title, department, location, employment_type, description,
        requirements, responsibilities, benefits, salary_range,
        status, application_deadline, posted_by, published_at
      ) VALUES (
        ${title}, ${department || null}, ${location || null}, 
        ${employment_type || null}, ${description},
        ${requirements || null}, ${responsibilities || null}, 
        ${benefits || null}, ${salary_range || null},
        ${status}, ${application_deadline ? new Date(application_deadline) : null},
        ${user.id}::uuid, ${status === 'published' ? new Date() : null}
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      data: (job as any[])[0],
      message: 'Job posting created successfully'
    });
  } catch (error: any) {
    console.error('Error creating job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job posting',
      error: error.message
    });
  }
};

export const updateJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      department,
      location,
      employment_type,
      description,
      requirements,
      responsibilities,
      benefits,
      salary_range,
      application_deadline,
      status
    } = req.body;

    // Check if job exists
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM job_postings WHERE id = $1::uuid`,
      id
    );

    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex++}`);
      values.push(department);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(location);
    }
    if (employment_type !== undefined) {
      updates.push(`employment_type = $${paramIndex++}`);
      values.push(employment_type);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (requirements !== undefined) {
      updates.push(`requirements = $${paramIndex++}`);
      values.push(requirements);
    }
    if (responsibilities !== undefined) {
      updates.push(`responsibilities = $${paramIndex++}`);
      values.push(responsibilities);
    }
    if (benefits !== undefined) {
      updates.push(`benefits = $${paramIndex++}`);
      values.push(benefits);
    }
    if (salary_range !== undefined) {
      updates.push(`salary_range = $${paramIndex++}`);
      values.push(salary_range);
    }
    if (application_deadline !== undefined) {
      updates.push(`application_deadline = $${paramIndex++}`);
      values.push(application_deadline ? new Date(application_deadline) : null);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      // Set published_at if status is being changed to published
      if (status === 'published') {
        updates.push(`published_at = COALESCE(published_at, NOW())`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updateQuery = `
      UPDATE job_postings 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    const job = await prisma.$queryRawUnsafe(updateQuery, ...values);

    res.json({
      success: true,
      data: (job as any[])[0],
      message: 'Job posting updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job posting',
      error: error.message
    });
  }
};

export const deleteJobPosting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$executeRaw`
      DELETE FROM job_postings WHERE id = ${id}::uuid
    `;

    res.json({
      success: true,
      message: 'Job posting deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job posting',
      error: error.message
    });
  }
};

// ============================================================================
// JOB APPLICATIONS
// ============================================================================

export const getJobApplications = async (req: Request, res: Response) => {
  try {
    const { job_posting_id, status, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (job_posting_id) {
      whereClause += ` AND job_posting_id = $${paramIndex++}`;
      params.push(job_posting_id);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const applications = await prisma.$queryRawUnsafe(`
      SELECT 
        id, job_posting_id, first_name, last_name, email, phone_number,
        cover_letter, resume_url, linkedin_url, portfolio_url,
        years_of_experience, current_position, current_company,
        expected_salary, availability_date, status, notes,
        reviewed_by, reviewed_at, created_at, updated_at
      FROM job_applications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, ...params, Number(limit), Number(offset));

    const total = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM job_applications WHERE ${whereClause}
    `, ...params);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total: Number((total as any[])[0]?.count || 0),
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error: any) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job applications',
      error: error.message
    });
  }
};

export const getJobApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.$queryRawUnsafe(
      `SELECT 
        id, job_posting_id, first_name, last_name, email, phone_number,
        cover_letter, resume_url, linkedin_url, portfolio_url,
        years_of_experience, current_position, current_company,
        expected_salary, availability_date, status, notes,
        reviewed_by, reviewed_at, created_at, updated_at
      FROM job_applications
      WHERE id = $1::uuid`,
      id
    );

    if (!application || (application as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    res.json({
      success: true,
      data: (application as any[])[0]
    });
  } catch (error: any) {
    console.error('Error fetching job application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job application',
      error: error.message
    });
  }
};

export const createJobApplication = async (req: Request, res: Response) => {
  try {
    const {
      job_posting_id,
      first_name,
      last_name,
      email,
      phone_number,
      cover_letter,
      resume_url,
      linkedin_url,
      portfolio_url,
      years_of_experience,
      current_position,
      current_company,
      expected_salary,
      availability_date
    } = req.body;

    if (!job_posting_id || !first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Job posting ID, first name, last name, and email are required'
      });
    }

    // Verify job posting exists and is published
    const job = await prisma.$queryRaw`
      SELECT id, status FROM job_postings WHERE id = ${job_posting_id}::uuid
    `;

    if (!job || (job as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    if ((job as any[])[0].status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Job posting is not published'
      });
    }

    const application = await prisma.$queryRaw`
      INSERT INTO job_applications (
        job_posting_id, first_name, last_name, email, phone_number,
        cover_letter, resume_url, linkedin_url, portfolio_url,
        years_of_experience, current_position, current_company,
        expected_salary, availability_date
      ) VALUES (
        ${job_posting_id}::uuid, ${first_name}, ${last_name}, ${email},
        ${phone_number || null}, ${cover_letter || null}, ${resume_url || null},
        ${linkedin_url || null}, ${portfolio_url || null},
        ${years_of_experience || null}, ${current_position || null},
        ${current_company || null}, ${expected_salary || null},
        ${availability_date ? new Date(availability_date) : null}
      )
      RETURNING *
    `;

    // Increment applications count
    await prisma.$executeRaw`
      UPDATE job_postings 
      SET applications_count = applications_count + 1 
      WHERE id = ${job_posting_id}::uuid
    `;

    res.status(201).json({
      success: true,
      data: (application as any[])[0],
      message: 'Application submitted successfully'
    });
  } catch (error: any) {
    console.error('Error creating job application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
};

export const updateJobApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { status, notes } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if application exists
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM job_applications WHERE id = $1::uuid`,
      id
    );

    if (!existing || (existing as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      // Use user_id from JWT claims (not id)
      const reviewerId = user.user_id || user.id;
      if (reviewerId) {
        updates.push(`reviewed_by = $${paramIndex++}::uuid`);
        values.push(reviewerId);
      }
      updates.push(`reviewed_at = NOW()`);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updateQuery = `
      UPDATE job_applications 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}::uuid
      RETURNING *
    `;
    values.push(id);

    const application = await prisma.$queryRawUnsafe(updateQuery, ...values);

    res.json({
      success: true,
      data: (application as any[])[0],
      message: 'Job application updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating job application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job application',
      error: error.message
    });
  }
};

// ============================================================================
// FAQs
// ============================================================================

export const getFAQs = async (req: Request, res: Response) => {
  try {
    const { is_published } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];

    if (is_published !== undefined) {
      whereClause += ` AND is_published = $1`;
      params.push(is_published === 'true');
    }

    const faqs = await prisma.$queryRawUnsafe(`
      SELECT 
        id, question, answer, category, order_index, is_published,
        created_by, created_at, updated_at
      FROM faqs
      WHERE ${whereClause}
      ORDER BY order_index ASC, created_at DESC
    `, ...params);

    res.json({
      success: true,
      data: faqs
    });
  } catch (error: any) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
};

export const createFAQ = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { question, answer, category, order_index, is_published = true } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question and answer are required'
      });
    }

    const faq = await prisma.$queryRawUnsafe(
      `INSERT INTO faqs (question, answer, category, order_index, is_published, created_by)
      VALUES ($1, $2, $3, $4, $5, $6::uuid)
      RETURNING *`,
      question,
      answer,
      category || null,
      order_index || 0,
      is_published,
      user.id
    );

    res.status(201).json({
      success: true,
      data: (faq as any[])[0],
      message: 'FAQ created successfully'
    });
  } catch (error: any) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
};

export const updateFAQ = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question, answer, category, order_index, is_published } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (question !== undefined) {
      updates.push(`question = $${paramIndex++}`);
      values.push(question);
    }
    if (answer !== undefined) {
      updates.push(`answer = $${paramIndex++}`);
      values.push(answer);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (order_index !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      values.push(order_index);
    }
    if (is_published !== undefined) {
      updates.push(`is_published = $${paramIndex++}`);
      values.push(is_published);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updateQuery = `
      UPDATE faqs 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    const faq = await prisma.$queryRawUnsafe(updateQuery, ...values);

    res.json({
      success: true,
      data: (faq as any[])[0],
      message: 'FAQ updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ',
      error: error.message
    });
  }
};

export const deleteFAQ = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$executeRawUnsafe(
      `DELETE FROM faqs WHERE id = $1::uuid`,
      id
    );

    res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ',
      error: error.message
    });
  }
};
