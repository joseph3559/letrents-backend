import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as taskController from '../controllers/task.controller.js';

const router = express.Router();

// All task routes require authentication
router.use(requireAuth);

// Task statistics
router.get('/stats', taskController.getTaskStats);

// CRUD operations
router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;

