import { Request, Response } from 'express';
import * as taskService from '../services/task.service.js';

/**
 * Create a new task
 * POST /api/v1/tasks
 */
export const createTask = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;

    console.log('🔍 Task creation request:', {
      userId,
      userRole,
      companyId,
      body: req.body,
    });

    if (!userId || !userRole || !companyId) {
      console.error('❌ Missing user information:', { userId, userRole, companyId });
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const { assigned_to, title } = req.body;

    if (!assigned_to || !title) {
      return res.status(400).json({
        success: false,
        message: 'assigned_to and title are required fields',
      });
    }

    const task = await taskService.createTask(req.body, userId, companyId);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error: any) {
    console.error('Error in createTask controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create task',
    });
  }
};

/**
 * Get all tasks with filters
 * GET /api/v1/tasks
 */
export const getTasks = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;
    const agencyId = user?.agency_id;

    if (!userId || !userRole || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const filters = {
      status: req.query.status as string,
      priority: req.query.priority as string,
      assigned_to: req.query.assigned_to as string,
      property_id: req.query.property_id as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const userObj = {
      id: userId,
      role: userRole,
      company_id: companyId,
      agency_id: agencyId,
    };

    const result = await taskService.getTasks(userObj, filters);

    res.status(200).json({
      success: true,
      message: 'Tasks retrieved successfully',
      data: result.tasks,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  } catch (error: any) {
    console.error('Error in getTasks controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve tasks',
    });
  }
};

/**
 * Get a single task by ID
 * GET /api/v1/tasks/:id
 */
export const getTaskById = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;
    const agencyId = user?.agency_id;
    const taskId = req.params.id;

    if (!userId || !userRole || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const userObj = {
      id: userId,
      role: userRole,
      company_id: companyId,
      agency_id: agencyId,
    };

    const task = await taskService.getTaskById(taskId, userObj);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task retrieved successfully',
      data: task,
    });
  } catch (error: any) {
    console.error('Error in getTaskById controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve task',
    });
  }
};

/**
 * Update a task
 * PUT /api/v1/tasks/:id
 */
export const updateTask = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;
    const agencyId = user?.agency_id;
    const taskId = req.params.id;

    if (!userId || !userRole || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const userObj = {
      id: userId,
      role: userRole,
      company_id: companyId,
      agency_id: agencyId,
    };

    const task = await taskService.updateTask(taskId, req.body, userObj);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task,
    });
  } catch (error: any) {
    console.error('Error in updateTask controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update task',
    });
  }
};

/**
 * Delete a task
 * DELETE /api/v1/tasks/:id
 */
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;
    const agencyId = user?.agency_id;
    const taskId = req.params.id;

    if (!userId || !userRole || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const userObj = {
      id: userId,
      role: userRole,
      company_id: companyId,
      agency_id: agencyId,
    };

    await taskService.deleteTask(taskId, userObj);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in deleteTask controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete task',
    });
  }
};

/**
 * Get task statistics
 * GET /api/v1/tasks/stats
 */
export const getTaskStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id;
    const userRole = user?.role;
    const companyId = user?.company_id;
    const agencyId = user?.agency_id;

    if (!userId || !userRole || !companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing user information',
      });
    }

    const userObj = {
      id: userId,
      role: userRole,
      company_id: companyId,
      agency_id: agencyId,
    };

    const stats = await taskService.getTaskStats(userObj);

    res.status(200).json({
      success: true,
      message: 'Task statistics retrieved successfully',
      data: stats,
    });
  } catch (error: any) {
    console.error('Error in getTaskStats controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve task statistics',
    });
  }
};

