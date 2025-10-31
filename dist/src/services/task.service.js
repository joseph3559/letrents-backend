import { PrismaClient } from '@prisma/client';
import { buildWhereClause } from '../utils/roleBasedFiltering.js';
const prisma = new PrismaClient();
/**
 * Create a new task
 */
export const createTask = async (taskData, createdBy, companyId) => {
    try {
        const task = await prisma.task.create({
            data: {
                company_id: companyId,
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority || 'medium',
                status: taskData.status || 'pending',
                assigned_to: taskData.assigned_to,
                assigned_by: createdBy,
                property_id: taskData.property_id,
                unit_id: taskData.unit_id,
                due_date: taskData.due_date ? new Date(taskData.due_date) : null,
                scheduled_start: taskData.scheduled_start
                    ? new Date(taskData.scheduled_start)
                    : null,
                estimated_hours: taskData.estimated_hours,
                notes: taskData.notes,
            },
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        role: true,
                    },
                },
                assignedBy: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        role: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
            },
        });
        return task;
    }
    catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
};
/**
 * Get tasks with role-based filtering
 */
export const getTasks = async (user, filters) => {
    try {
        // Build user object for buildWhereClause
        const userClaims = {
            user_id: user.id,
            role: user.role,
            company_id: user.company_id,
            agency_id: user.agency_id,
        };
        const whereClause = buildWhereClause(userClaims, {}, 'task');
        // Add additional filters
        if (filters?.status) {
            whereClause.status = filters.status;
        }
        if (filters?.priority) {
            whereClause.priority = filters.priority;
        }
        if (filters?.assigned_to) {
            whereClause.assigned_to = filters.assigned_to;
        }
        if (filters?.property_id) {
            whereClause.property_id = filters.property_id;
        }
        // For caretakers/staff, show only tasks assigned to them
        if (user.role === 'caretaker' || user.role === 'agent') {
            whereClause.assigned_to = user.id;
        }
        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where: whereClause,
                include: {
                    assignedTo: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            role: true,
                        },
                    },
                    assignedBy: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            role: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                        },
                    },
                },
                orderBy: [{ priority: 'desc' }, { due_date: 'asc' }, { created_at: 'desc' }],
                take: filters?.limit || 100,
                skip: filters?.offset || 0,
            }),
            prisma.task.count({ where: whereClause }),
        ]);
        return { tasks, total };
    }
    catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
};
/**
 * Get a single task by ID
 */
export const getTaskById = async (taskId, user) => {
    try {
        const userClaims = {
            user_id: user.id,
            role: user.role,
            company_id: user.company_id,
            agency_id: user.agency_id,
        };
        const whereClause = buildWhereClause(userClaims, {}, 'task');
        whereClause.id = taskId;
        // For caretakers/staff, ensure they can only see their own tasks
        if (user.role === 'caretaker' || user.role === 'agent') {
            whereClause.assigned_to = user.id;
        }
        const task = await prisma.task.findFirst({
            where: whereClause,
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                        role: true,
                    },
                },
                assignedBy: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        role: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
            },
        });
        return task;
    }
    catch (error) {
        console.error('Error fetching task:', error);
        throw error;
    }
};
/**
 * Update a task
 */
export const updateTask = async (taskId, updateData, user) => {
    try {
        // Build where clause to ensure user has permission to update this task
        const userClaims = {
            user_id: user.id,
            role: user.role,
            company_id: user.company_id,
            agency_id: user.agency_id,
        };
        const whereClause = buildWhereClause(userClaims, {}, 'task');
        whereClause.id = taskId;
        // For caretakers/staff, ensure they can only update their own tasks
        if (user.role === 'caretaker' || user.role === 'agent') {
            whereClause.assigned_to = user.id;
        }
        // Check if task exists and user has permission
        const existingTask = await prisma.task.findFirst({
            where: whereClause,
        });
        if (!existingTask) {
            throw new Error('Task not found or you do not have permission to update it');
        }
        // Prepare update data
        const updatePayload = {
            ...updateData,
            updated_at: new Date(),
        };
        // Convert date strings to Date objects
        if (updateData.due_date) {
            updatePayload.due_date = new Date(updateData.due_date);
        }
        if (updateData.scheduled_start) {
            updatePayload.scheduled_start = new Date(updateData.scheduled_start);
        }
        if (updateData.started_at) {
            updatePayload.started_at = new Date(updateData.started_at);
        }
        if (updateData.completed_at) {
            updatePayload.completed_at = new Date(updateData.completed_at);
        }
        // Auto-set started_at when status changes to in_progress
        if (updateData.status === 'in_progress' && !existingTask.started_at) {
            updatePayload.started_at = new Date();
        }
        // Auto-set completed_at when status changes to completed
        if (updateData.status === 'completed' && !existingTask.completed_at) {
            updatePayload.completed_at = new Date();
        }
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: updatePayload,
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        role: true,
                    },
                },
                assignedBy: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        role: true,
                    },
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    },
                },
            },
        });
        return updatedTask;
    }
    catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
};
/**
 * Delete a task
 */
export const deleteTask = async (taskId, user) => {
    try {
        // Build where clause to ensure user has permission to delete this task
        const userClaims = {
            user_id: user.id,
            role: user.role,
            company_id: user.company_id,
            agency_id: user.agency_id,
        };
        const whereClause = buildWhereClause(userClaims, {}, 'task');
        whereClause.id = taskId;
        // Only landlords and admins can delete tasks
        if (user.role === 'caretaker' || user.role === 'agent' || user.role === 'tenant') {
            throw new Error('You do not have permission to delete tasks');
        }
        // Check if task exists and user has permission
        const existingTask = await prisma.task.findFirst({
            where: whereClause,
        });
        if (!existingTask) {
            throw new Error('Task not found or you do not have permission to delete it');
        }
        await prisma.task.delete({
            where: { id: taskId },
        });
        return { success: true, message: 'Task deleted successfully' };
    }
    catch (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
};
/**
 * Get task statistics for a user (e.g., for dashboard)
 */
export const getTaskStats = async (user) => {
    try {
        const userClaims = {
            user_id: user.id,
            role: user.role,
            company_id: user.company_id,
            agency_id: user.agency_id,
        };
        const whereClause = buildWhereClause(userClaims, {}, 'task');
        // For caretakers/staff, show only their tasks
        if (user.role === 'caretaker' || user.role === 'agent') {
            whereClause.assigned_to = user.id;
        }
        const [total, pending, in_progress, completed, overdue] = await Promise.all([
            prisma.task.count({ where: whereClause }),
            prisma.task.count({ where: { ...whereClause, status: 'pending' } }),
            prisma.task.count({ where: { ...whereClause, status: 'in_progress' } }),
            prisma.task.count({ where: { ...whereClause, status: 'completed' } }),
            prisma.task.count({
                where: {
                    ...whereClause,
                    status: { not: 'completed' },
                    due_date: { lt: new Date() },
                },
            }),
        ]);
        return {
            total,
            pending,
            in_progress,
            completed,
            overdue,
        };
    }
    catch (error) {
        console.error('Error fetching task stats:', error);
        throw error;
    }
};
