import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getJobPostings, getJobPosting, createJobPosting, updateJobPosting, deleteJobPosting, getJobApplications, getJobApplication, createJobApplication, updateJobApplication, getFAQs, createFAQ, updateFAQ, deleteFAQ } from '../controllers/marketing.controller.js';
const router = Router();
// Public routes (no auth required)
router.get('/jobs', getJobPostings); // Public: Get published jobs
router.get('/jobs/:id', getJobPosting); // Public: Get single job
router.post('/jobs/:id/apply', createJobApplication); // Public: Submit application
// Protected routes (require auth)
router.use(requireAuth);
// Job Postings Management (Super Admin)
router.post('/jobs', createJobPosting);
router.put('/jobs/:id', updateJobPosting);
router.delete('/jobs/:id', deleteJobPosting);
// Job Applications Management (Super Admin)
router.get('/applications', getJobApplications);
router.get('/applications/:id', getJobApplication);
router.put('/applications/:id', updateJobApplication);
// FAQs Management (Super Admin)
router.get('/faqs', getFAQs);
router.post('/faqs', createFAQ);
router.put('/faqs/:id', updateFAQ);
router.delete('/faqs/:id', deleteFAQ);
export default router;
