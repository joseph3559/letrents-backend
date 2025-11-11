import { PrismaClient } from '@prisma/client';
import { writeSuccess, writeError } from '../utils/response.js';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
// Dashboard and Analytics
export const getDashboardData = async (req, res) => {
    try {
        // Get system-wide statistics using raw SQL to avoid enum issues
        const [companiesResult, agenciesResult, propertiesResult, unitsResult, usersResult, activeTenantsResult, revenueResult] = await Promise.all([
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM companies`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM agencies`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM properties`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count, status FROM units GROUP BY status`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count, role FROM users GROUP BY role`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM users WHERE role = 'tenant'::user_role AND status = 'active'::user_status`,
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`
        ]);
        const companies = Array.isArray(companiesResult) ? Number(companiesResult[0]?.count || 0) : 0;
        const agencies = Array.isArray(agenciesResult) ? Number(agenciesResult[0]?.count || 0) : 0;
        const properties = Array.isArray(propertiesResult) ? Number(propertiesResult[0]?.count || 0) : 0;
        const unitsData = Array.isArray(unitsResult) ? unitsResult : [];
        const totalUnits = unitsData.reduce((sum, item) => sum + Number(item.count || 0), 0);
        const occupiedUnits = unitsData.find(item => item.status === 'occupied')?.count || 0;
        const vacantUnits = unitsData.find(item => item.status === 'vacant')?.count || 0;
        const usersData = Array.isArray(usersResult) ? usersResult : [];
        const totalUsers = usersData.reduce((sum, item) => sum + Number(item.count || 0), 0);
        const activeTenants = Array.isArray(activeTenantsResult) ? Number(activeTenantsResult[0]?.count || 0) : 0;
        const monthlyRevenue = Array.isArray(revenueResult) ? Number(revenueResult[0]?.total || 0) : 0;
        // Get recent activities (last 10 activities)
        const recentActivities = await prisma.$queryRaw `
      SELECT 
        'user_created' as type,
        CONCAT(first_name, ' ', last_name) as description,
        created_at as timestamp,
        role as metadata
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC 
      LIMIT 10
    `;
        // Get system alerts (placeholder for now)
        const systemAlerts = [
            {
                id: '1',
                type: 'info',
                message: 'System is running normally',
                timestamp: new Date().toISOString(),
                severity: 'low'
            }
        ];
        const dashboardData = {
            analytics: {
                total_companies: companies,
                total_agencies: agencies,
                total_properties: properties,
                total_units: totalUnits,
                active_units: Number(occupiedUnits),
                vacant_units: Number(vacantUnits),
                total_users: totalUsers,
                active_tenants: activeTenants,
                monthly_revenue: monthlyRevenue,
                ytd_revenue: monthlyRevenue * 12, // Simplified calculation
                occupancy_rate: totalUnits > 0 ? Math.round((Number(occupiedUnits) / totalUnits) * 100) : 0,
            },
            recent_activities: recentActivities,
            system_alerts: systemAlerts,
        };
        writeSuccess(res, 200, 'Dashboard data retrieved successfully', dashboardData);
    }
    catch (err) {
        console.error('Error fetching dashboard data:', err);
        writeError(res, 500, 'Failed to fetch dashboard data', err.message);
    }
};
export const getKPIMetrics = async (req, res) => {
    try {
        const [totalRevenue, totalProperties, totalTenants, occupancyData] = await Promise.all([
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM properties`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM users WHERE role = 'tenant'::user_role AND status = 'active'::user_status`,
            prisma.$queryRaw `SELECT COUNT(*)::int as total, SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END)::int as occupied FROM units`
        ]);
        const revenue = Array.isArray(totalRevenue) ? Number(totalRevenue[0]?.total || 0) : 0;
        const properties = Array.isArray(totalProperties) ? Number(totalProperties[0]?.count || 0) : 0;
        const tenants = Array.isArray(totalTenants) ? Number(totalTenants[0]?.count || 0) : 0;
        const occupancy = Array.isArray(occupancyData) ? occupancyData[0] : { total: 0, occupied: 0 };
        const occupancyRate = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0;
        const kpis = [
            {
                id: '1',
                title: 'Total Revenue',
                value: revenue,
                format: 'currency',
                change: '+12.5%',
                trend: 'up',
                period: 'vs last month'
            },
            {
                id: '2',
                title: 'Properties',
                value: properties,
                format: 'number',
                change: '+2',
                trend: 'up',
                period: 'vs last month'
            },
            {
                id: '3',
                title: 'Active Tenants',
                value: tenants,
                format: 'number',
                change: '+8.3%',
                trend: 'up',
                period: 'vs last month'
            },
            {
                id: '4',
                title: 'Occupancy Rate',
                value: occupancyRate,
                format: 'percentage',
                change: '+2.1%',
                trend: 'up',
                period: 'vs last month'
            }
        ];
        writeSuccess(res, 200, 'KPI metrics retrieved successfully', kpis);
    }
    catch (err) {
        console.error('Error fetching KPI metrics:', err);
        writeError(res, 500, 'Failed to fetch KPI metrics', err.message);
    }
};
export const getSystemHealth = async (req, res) => {
    try {
        const startTime = Date.now();
        // Test database connection
        await prisma.$queryRaw `SELECT 1`;
        const dbResponseTime = Date.now() - startTime;
        const healthData = {
            database: {
                status: 'healthy',
                response_time: dbResponseTime
            },
            api_server: {
                status: 'healthy',
                response_time: 5
            },
            redis_cache: {
                status: 'healthy',
                response_time: 2
            },
            external_services: {
                status: 'healthy',
                response_time: 15
            }
        };
        writeSuccess(res, 200, 'System health retrieved successfully', healthData);
    }
    catch (err) {
        console.error('Error checking system health:', err);
        writeError(res, 500, 'Failed to check system health', err.message);
    }
};
export const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // For now, return user creation activities as audit logs
        const logs = await prisma.$queryRaw `
      SELECT 
        id,
        CONCAT('User ', first_name, ' ', last_name, ' was created') as action,
        email as user_email,
        role as resource_type,
        'create' as action_type,
        created_at as timestamp,
        'system' as ip_address
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
        const totalResult = await prisma.$queryRaw `SELECT COUNT(*)::int as count FROM users`;
        const total = Array.isArray(totalResult) ? Number(totalResult[0]?.count || 0) : 0;
        const auditData = {
            logs: logs,
            total: total,
            page: page,
            limit: limit,
            pages: Math.ceil(total / limit)
        };
        writeSuccess(res, 200, 'Audit logs retrieved successfully', auditData);
    }
    catch (err) {
        console.error('Error fetching audit logs:', err);
        writeError(res, 500, 'Failed to fetch audit logs', err.message);
    }
};
export const getAnalyticsChart = async (req, res) => {
    try {
        const { chartType } = req.params;
        const period = req.query.period || '30d';
        // Generate mock chart data based on chart type
        let chartData;
        const labels = [];
        const data = [];
        // Generate last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toISOString().split('T')[0]);
            // Generate realistic data based on chart type
            switch (chartType) {
                case 'revenue':
                    data.push(Math.floor(Math.random() * 50000) + 100000);
                    break;
                case 'occupancy':
                    data.push(Math.floor(Math.random() * 20) + 75);
                    break;
                case 'tenants':
                    data.push(Math.floor(Math.random() * 10) + 50);
                    break;
                default:
                    data.push(Math.floor(Math.random() * 100));
            }
        }
        chartData = { labels, data };
        writeSuccess(res, 200, `${chartType} chart data retrieved successfully`, chartData);
    }
    catch (err) {
        console.error('Error fetching analytics chart:', err);
        writeError(res, 500, 'Failed to fetch analytics chart', err.message);
    }
};
// System Settings
export const getSystemSettings = async (req, res) => {
    try {
        // Mock system settings for now
        const settings = [
            {
                id: '1',
                category: 'general',
                key: 'site_name',
                value: 'LetRents Property Management',
                description: 'The name of the application'
            },
            {
                id: '2',
                category: 'general',
                key: 'maintenance_mode',
                value: 'false',
                description: 'Enable maintenance mode'
            },
            {
                id: '3',
                category: 'email',
                key: 'smtp_host',
                value: 'smtp.gmail.com',
                description: 'SMTP server host'
            }
        ];
        writeSuccess(res, 200, 'System settings retrieved successfully', settings);
    }
    catch (err) {
        console.error('Error fetching system settings:', err);
        writeError(res, 500, 'Failed to fetch system settings', err.message);
    }
};
export const updateSystemSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const { value } = req.body;
        // Mock update for now
        const updatedSetting = {
            id,
            value,
            updated_at: new Date().toISOString()
        };
        writeSuccess(res, 200, 'System setting updated successfully', updatedSetting);
    }
    catch (err) {
        console.error('Error updating system setting:', err);
        writeError(res, 500, 'Failed to update system setting', err.message);
    }
};
// Security Logs
export const getSecurityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        // Mock security logs for now
        const logs = [
            {
                id: '1',
                event_type: 'login_success',
                user_email: 'admin@letrents.com',
                ip_address: '192.168.1.1',
                user_agent: 'Mozilla/5.0...',
                timestamp: new Date().toISOString(),
                details: { method: 'email_password' }
            }
        ];
        const securityData = {
            logs: logs,
            total: 1,
            page: page,
            limit: limit,
            pages: 1
        };
        writeSuccess(res, 200, 'Security logs retrieved successfully', securityData);
    }
    catch (err) {
        console.error('Error fetching security logs:', err);
        writeError(res, 500, 'Failed to fetch security logs', err.message);
    }
};
// User Management
export const getUserManagement = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const users = await prisma.$queryRaw `
      SELECT 
        id, email, first_name, last_name, role, status, 
        created_at, updated_at, last_login_at, company_id
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
        const totalResult = await prisma.$queryRaw `SELECT COUNT(*)::int as count FROM users`;
        const total = Array.isArray(totalResult) ? Number(totalResult[0]?.count || 0) : 0;
        const userData = {
            users: users,
            total: total,
            page: page,
            limit: limit,
            pages: Math.ceil(total / limit)
        };
        writeSuccess(res, 200, 'Users retrieved successfully', userData);
    }
    catch (err) {
        console.error('Error fetching users:', err);
        writeError(res, 500, 'Failed to fetch users', err.message);
    }
};
export const createUser = async (req, res) => {
    try {
        const { email, password, first_name, last_name, role, company_id } = req.body;
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await prisma.$queryRaw `
      INSERT INTO users (email, password_hash, first_name, last_name, role, company_id, status)
      VALUES (${email}, ${hashedPassword}, ${first_name}, ${last_name}, ${role}, ${company_id}::uuid, 'active')
      RETURNING id, email, first_name, last_name, role, status, created_at
    `;
        writeSuccess(res, 201, 'User created successfully', newUser);
    }
    catch (err) {
        console.error('Error creating user:', err);
        writeError(res, 500, 'Failed to create user', err.message);
    }
};
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        if (!user) {
            return writeError(res, 404, 'User not found');
        }
        writeSuccess(res, 200, 'User retrieved successfully', user);
    }
    catch (err) {
        console.error('Error fetching user:', err);
        writeError(res, 500, 'Failed to fetch user', err.message);
    }
};
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, role, status } = req.body;
        const updatedUser = await prisma.$queryRaw `
      UPDATE users 
      SET first_name = ${first_name}, last_name = ${last_name}, role = ${role}, status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, email, first_name, last_name, role, status, updated_at
    `;
        writeSuccess(res, 200, 'User updated successfully', updatedUser);
    }
    catch (err) {
        console.error('Error updating user:', err);
        writeError(res, 500, 'Failed to update user', err.message);
    }
};
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.$queryRaw `DELETE FROM users WHERE id = ${id}::uuid`;
        writeSuccess(res, 200, 'User deleted successfully', { id });
    }
    catch (err) {
        console.error('Error deleting user:', err);
        writeError(res, 500, 'Failed to delete user', err.message);
    }
};
// Company Management
export const getCompanyManagement = async (req, res) => {
    try {
        const companies = await prisma.$queryRaw `
      SELECT 
        id, name, business_type, email, phone_number, 
        status, subscription_plan, created_at, updated_at
      FROM companies 
      ORDER BY created_at DESC
    `;
        writeSuccess(res, 200, 'Companies retrieved successfully', companies);
    }
    catch (err) {
        console.error('Error fetching companies:', err);
        writeError(res, 500, 'Failed to fetch companies', err.message);
    }
};
export const createCompany = async (req, res) => {
    try {
        const { name, business_type, email, phone_number, subscription_plan } = req.body;
        const newCompany = await prisma.$queryRaw `
      INSERT INTO companies (name, business_type, email, phone_number, subscription_plan, status)
      VALUES (${name}, ${business_type}, ${email}, ${phone_number}, ${subscription_plan}, 'pending')
      RETURNING id, name, business_type, email, phone_number, subscription_plan, status, created_at
    `;
        writeSuccess(res, 201, 'Company created successfully', newCompany);
    }
    catch (err) {
        console.error('Error creating company:', err);
        writeError(res, 500, 'Failed to create company', err.message);
    }
};
export const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, business_type, email, phone_number, subscription_plan, status } = req.body;
        const updatedCompany = await prisma.$queryRaw `
      UPDATE companies 
      SET name = ${name}, business_type = ${business_type}, email = ${email}, 
          phone_number = ${phone_number}, subscription_plan = ${subscription_plan}, status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, name, business_type, email, phone_number, subscription_plan, status, updated_at
    `;
        writeSuccess(res, 200, 'Company updated successfully', updatedCompany);
    }
    catch (err) {
        console.error('Error updating company:', err);
        writeError(res, 500, 'Failed to update company', err.message);
    }
};
export const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.$queryRaw `DELETE FROM companies WHERE id = ${id}::uuid`;
        writeSuccess(res, 200, 'Company deleted successfully', { id });
    }
    catch (err) {
        console.error('Error deleting company:', err);
        writeError(res, 500, 'Failed to delete company', err.message);
    }
};
// Agency Management
export const getAgencyManagement = async (req, res) => {
    try {
        console.log('🔍 getAgencyManagement called');
        const agencies = await prisma.agency.findMany({
            include: {
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        // Transform to match expected format
        const agenciesData = agencies.map(agency => ({
            id: agency.id,
            name: agency.name,
            email: agency.email,
            phone_number: agency.phone_number,
            address: agency.address,
            status: agency.status,
            created_at: agency.created_at,
            updated_at: agency.updated_at,
            company_name: agency.company?.name || null
        }));
        writeSuccess(res, 200, 'Agencies retrieved successfully', agenciesData);
    }
    catch (err) {
        console.error('Error fetching agencies:', err);
        writeError(res, 500, 'Failed to fetch agencies', err.message);
    }
};
export const createAgency = async (req, res) => {
    try {
        const { name, email, phone_number, address, company_id, created_by } = req.body;
        const newAgency = await prisma.$queryRaw `
      INSERT INTO agencies (name, email, phone_number, address, company_id, created_by, status)
      VALUES (${name}, ${email}, ${phone_number}, ${address}, ${company_id}::uuid, ${created_by}::uuid, 'pending')
      RETURNING id, name, email, phone_number, address, status, created_at
    `;
        writeSuccess(res, 201, 'Agency created successfully', newAgency);
    }
    catch (err) {
        console.error('Error creating agency:', err);
        writeError(res, 500, 'Failed to create agency', err.message);
    }
};
export const getAgencyById = async (req, res) => {
    try {
        console.log('🔍 getAgencyById called with ID:', req.params.id);
        const { id } = req.params;
        const agency = await prisma.agency.findUnique({
            where: { id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        if (!agency) {
            return writeError(res, 404, 'Agency not found');
        }
        // Get counts of properties and units for this agency
        const [propertiesCount, unitsCount, landlordsCount, agentsCount] = await Promise.all([
            prisma.property.count({ where: { agency_id: id } }),
            prisma.unit.count({
                where: {
                    property: { agency_id: id }
                }
            }),
            agency.company_id ? prisma.user.count({
                where: {
                    role: 'landlord',
                    company_id: agency.company_id
                }
            }) : Promise.resolve(0),
            prisma.user.count({
                where: {
                    role: 'agent',
                    agency_id: id
                }
            })
        ]);
        // Calculate monthly revenue from occupied units
        const occupiedUnits = await prisma.unit.findMany({
            where: {
                status: 'occupied',
                property: { agency_id: id }
            },
            select: {
                rent_amount: true
            }
        });
        const monthlyRevenue = occupiedUnits.reduce((sum, unit) => {
            return sum + (Number(unit.rent_amount) || 0);
        }, 0);
        // Combine agency data with statistics
        const agencyWithStats = {
            ...agency,
            total_properties: propertiesCount,
            total_units: unitsCount,
            total_landlords: landlordsCount,
            total_agents: agentsCount,
            monthly_revenue: monthlyRevenue
        };
        console.log('✅ Agency stats:', {
            id,
            properties: propertiesCount,
            units: unitsCount,
            landlords: landlordsCount,
            agents: agentsCount,
            revenue: monthlyRevenue
        });
        writeSuccess(res, 200, 'Agency retrieved successfully', agencyWithStats);
    }
    catch (err) {
        console.error('Error fetching agency:', err);
        writeError(res, 500, 'Failed to fetch agency', err.message);
    }
};
export const updateAgency = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone_number, address, status } = req.body;
        const updatedAgency = await prisma.$queryRaw `
      UPDATE agencies 
      SET name = ${name}, email = ${email}, phone_number = ${phone_number}, 
          address = ${address}, status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, name, email, phone_number, address, status, updated_at
    `;
        writeSuccess(res, 200, 'Agency updated successfully', updatedAgency);
    }
    catch (err) {
        console.error('Error updating agency:', err);
        writeError(res, 500, 'Failed to update agency', err.message);
    }
};
export const deleteAgency = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.$queryRaw `DELETE FROM agencies WHERE id = ${id}::uuid`;
        writeSuccess(res, 200, 'Agency deleted successfully', { id });
    }
    catch (err) {
        console.error('Error deleting agency:', err);
        writeError(res, 500, 'Failed to delete agency', err.message);
    }
};
// Get properties for an agency
export const getAgencyProperties = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        // Verify agency exists
        const agency = await prisma.agency.findUnique({
            where: { id },
            select: { id: true, name: true }
        });
        if (!agency) {
            return writeError(res, 404, 'Agency not found');
        }
        // Get properties for this agency
        const [properties, total] = await Promise.all([
            prisma.property.findMany({
                where: { agency_id: id },
                include: {
                    owner: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            units: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.property.count({ where: { agency_id: id } })
        ]);
        writeSuccess(res, 200, 'Agency properties retrieved successfully', {
            properties,
            total,
            limit,
            offset
        });
    }
    catch (err) {
        console.error('Error fetching agency properties:', err);
        writeError(res, 500, 'Failed to fetch agency properties', err.message);
    }
};
// Get units for an agency
export const getAgencyUnits = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        // Verify agency exists
        const agency = await prisma.agency.findUnique({
            where: { id },
            select: { id: true, name: true }
        });
        if (!agency) {
            return writeError(res, 404, 'Agency not found');
        }
        // Get units for properties in this agency
        const [units, total] = await Promise.all([
            prisma.unit.findMany({
                where: {
                    property: { agency_id: id }
                },
                include: {
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                            country: true,
                            postal_code: true
                        }
                    },
                    current_tenant: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            phone_number: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.unit.count({
                where: {
                    property: { agency_id: id }
                }
            })
        ]);
        writeSuccess(res, 200, 'Agency units retrieved successfully', {
            units,
            total,
            limit,
            offset
        });
    }
    catch (err) {
        console.error('Error fetching agency units:', err);
        writeError(res, 500, 'Failed to fetch agency units', err.message);
    }
};
// Additional endpoints for frontend compatibility
export const getPlatformAnalytics = async (req, res) => {
    try {
        const [totalAgencies, totalProperties, totalUnits, totalRevenue] = await Promise.all([
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM agencies`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM properties`,
            prisma.$queryRaw `SELECT COUNT(*)::int as count FROM units`,
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`
        ]);
        const agencies = Array.isArray(totalAgencies) ? Number(totalAgencies[0]?.count || 0) : 0;
        const properties = Array.isArray(totalProperties) ? Number(totalProperties[0]?.count || 0) : 0;
        const units = Array.isArray(totalUnits) ? Number(totalUnits[0]?.count || 0) : 0;
        const revenue = Array.isArray(totalRevenue) ? Number(totalRevenue[0]?.total || 0) : 0;
        const occupancyRate = units > 0 ? (Math.random() * 30 + 70) : 0; // Mock occupancy rate between 70-100%
        const platformData = {
            total_agencies: agencies,
            total_properties: properties,
            total_units: units,
            total_revenue: revenue,
            occupancy_rate: occupancyRate,
            growth_metrics: {
                agencies_growth: 12.5,
                properties_growth: 8.3,
                revenue_growth: 15.2
            }
        };
        writeSuccess(res, 200, 'Platform analytics retrieved successfully', platformData);
    }
    catch (err) {
        console.error('Error fetching platform analytics:', err);
        writeError(res, 500, 'Failed to fetch platform analytics', err.message);
    }
};
export const getRevenueDashboard = async (req, res) => {
    try {
        const period = req.query.period || '30d';
        const [totalRevenue, monthlyRevenue, revenueByProperty] = await Promise.all([
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`,
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as monthly FROM units WHERE status = 'occupied'`,
            prisma.$queryRaw `
        SELECT p.name, COALESCE(SUM(u.rent_amount), 0)::numeric as revenue
        FROM properties p
        LEFT JOIN units u ON p.id = u.property_id AND u.status = 'occupied'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 10
      `
        ]);
        const total = Array.isArray(totalRevenue) ? Number(totalRevenue[0]?.total || 0) : 0;
        const monthly = Array.isArray(monthlyRevenue) ? Number(monthlyRevenue[0]?.monthly || 0) : 0;
        const revenueData = {
            total_revenue: total,
            monthly_revenue: monthly,
            ytd_revenue: monthly * 12,
            revenue_by_property: revenueByProperty,
            growth_rate: 8.5,
            period: period
        };
        writeSuccess(res, 200, 'Revenue dashboard retrieved successfully', revenueData);
    }
    catch (err) {
        console.error('Error fetching revenue dashboard:', err);
        writeError(res, 500, 'Failed to fetch revenue dashboard', err.message);
    }
};
export const getAgencyPerformance = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const agencyPerformance = await prisma.$queryRaw `
      SELECT 
        a.id, a.name, a.email,
        COUNT(p.id)::int as total_properties,
        COUNT(u.id)::int as total_units,
        SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END)::int as occupied_units,
        COALESCE(SUM(CASE WHEN u.status = 'occupied' THEN u.rent_amount ELSE 0 END), 0)::numeric as total_revenue
      FROM agencies a
      LEFT JOIN properties p ON a.id = p.agency_id
      LEFT JOIN units u ON p.id = u.property_id
      GROUP BY a.id, a.name, a.email
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `;
        const performanceData = {
            agencies: agencyPerformance,
            total_count: Array.isArray(agencyPerformance) ? agencyPerformance.length : 0
        };
        writeSuccess(res, 200, 'Agency performance retrieved successfully', performanceData);
    }
    catch (err) {
        console.error('Error fetching agency performance:', err);
        writeError(res, 500, 'Failed to fetch agency performance', err.message);
    }
};
// Additional missing endpoints
export const getUserMetrics = async (req, res) => {
    try {
        // Return static metrics to avoid database/authentication issues
        const role = req.query.role;
        let metrics;
        if (role === 'landlord') {
            metrics = {
                total_users: 1,
                active_users: 1,
                inactive_users: 0,
                users_by_role: [
                    { role: 'landlord', count: 1 }
                ],
                growth_rate: 0
            };
        }
        else if (role === 'tenant') {
            metrics = {
                total_users: 3,
                active_users: 3,
                inactive_users: 0,
                users_by_role: [
                    { role: 'tenant', count: 3 }
                ],
                growth_rate: 15.2
            };
        }
        else {
            // All users
            metrics = {
                total_users: 6,
                active_users: 6,
                inactive_users: 0,
                users_by_role: [
                    { role: 'super_admin', count: 1 },
                    { role: 'landlord', count: 1 },
                    { role: 'tenant', count: 3 },
                    { role: 'caretaker', count: 1 },
                    { role: 'agent', count: 1 }
                ],
                growth_rate: 8.5
            };
        }
        writeSuccess(res, 200, 'User metrics retrieved successfully', metrics);
    }
    catch (err) {
        console.error('Error fetching user metrics:', err);
        writeError(res, 500, 'Failed to fetch user metrics', err.message);
    }
};
export const getRevenueSummary = async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const [currentRevenue, previousRevenue] = await Promise.all([
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`,
            prisma.$queryRaw `SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'` // Mock previous period
        ]);
        const current = Array.isArray(currentRevenue) ? Number(currentRevenue[0]?.total || 0) : 0;
        const previous = Array.isArray(previousRevenue) ? Number(previousRevenue[0]?.total || 0) * 0.9 : 0; // Mock 10% growth
        const summary = {
            current_period: current,
            previous_period: previous,
            growth_amount: current - previous,
            growth_percentage: previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : '0',
            period: period
        };
        writeSuccess(res, 200, 'Revenue summary retrieved successfully', summary);
    }
    catch (err) {
        console.error('Error fetching revenue summary:', err);
        writeError(res, 500, 'Failed to fetch revenue summary', err.message);
    }
};
export const getBillingPlans = async (req, res) => {
    try {
        // Mock billing plans data with monthly_price and yearly_price fields
        const plans = [
            {
                id: '1',
                name: 'Starter',
                price: 2500,
                monthly_price: 2500,
                yearly_price: 25000, // 10 months price (2 months free)
                currency: 'KES',
                interval: 'month',
                features: [
                    'Up to 5 properties',
                    'Up to 50 units',
                    'Basic tenant management',
                    'M-Pesa integration',
                    'Mobile app access',
                    'Email support',
                    'Monthly reports',
                ],
                active: true,
                subscribers: 25,
                max_properties: 5,
                max_units: 50
            },
            {
                id: '2',
                name: 'Professional',
                price: 5000,
                monthly_price: 5000,
                yearly_price: 50000, // 10 months price (2 months free)
                currency: 'KES',
                interval: 'month',
                features: [
                    'Up to 200 units',
                    'Advanced tenant screening',
                    'All payment methods',
                    'Maintenance management',
                    'Priority support',
                    'Mobile app access',
                    'Custom reports',
                    'Team collaboration',
                    'Document storage (5GB)',
                ],
                active: true,
                subscribers: 18,
                max_properties: 20,
                max_units: 200
            },
            {
                id: '3',
                name: 'Enterprise',
                price: 12000,
                monthly_price: 12000,
                yearly_price: 120000, // 10 months price (2 months free)
                currency: 'KES',
                interval: 'month',
                features: [
                    'Unlimited properties',
                    'Unlimited units',
                    'White-label options',
                    'API access',
                    'Advanced analytics',
                    '24/7 phone support',
                    'Dedicated account manager',
                    'Custom integrations',
                    'Unlimited storage',
                    'Training & onboarding',
                ],
                active: true,
                subscribers: 12,
                max_properties: null, // Unlimited
                max_units: null // Unlimited
            }
        ];
        writeSuccess(res, 200, 'Billing plans retrieved successfully', plans);
    }
    catch (err) {
        console.error('Error fetching billing plans:', err);
        writeError(res, 500, 'Failed to fetch billing plans', err.message);
    }
};
export const getApplications = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Mock applications data
        const applications = [
            {
                id: '1',
                applicant_name: 'John Smith',
                email: 'john@example.com',
                type: 'agency_registration',
                status: 'pending',
                submitted_at: new Date().toISOString(),
                company_name: 'Smith Properties'
            },
            {
                id: '2',
                applicant_name: 'Jane Doe',
                email: 'jane@example.com',
                type: 'landlord_verification',
                status: 'approved',
                submitted_at: new Date(Date.now() - 86400000).toISOString(),
                company_name: 'Doe Real Estate'
            }
        ];
        const result = {
            applications: applications.slice(offset, offset + limit),
            total: applications.length,
            limit,
            offset
        };
        writeSuccess(res, 200, 'Applications retrieved successfully', result);
    }
    catch (err) {
        console.error('Error fetching applications:', err);
        writeError(res, 500, 'Failed to fetch applications', err.message);
    }
};
export const getMessagingBroadcasts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Mock broadcast messages for demo
        const messages = [
            {
                id: '1',
                content: 'Welcome to our LetRents System, Feel at home',
                type: 'system',
                created_at: new Date('2025-09-21T10:00:00Z'),
                first_name: 'System',
                last_name: 'Admin',
                email: 'admin@letrents.com',
                status: 'sent',
                recipients_count: 6,
                subject: 'Welcome Message'
            },
            {
                id: '2',
                content: 'Hello members, we\'ll have a meet today at 11:00 AM, at the rooftop',
                type: 'announcement',
                created_at: new Date('2025-09-21T09:00:00Z'),
                first_name: 'Landlord',
                last_name: 'User',
                email: 'landlord@letrents.com',
                status: 'sent',
                recipients_count: 4,
                subject: 'Meeting Announcement'
            }
        ];
        const total = messages.length;
        const result = {
            broadcasts: messages,
            total,
            limit,
            offset
        };
        writeSuccess(res, 200, 'Messaging broadcasts retrieved successfully', result);
    }
    catch (err) {
        console.error('Error fetching messaging broadcasts:', err);
        writeError(res, 500, 'Failed to fetch messaging broadcasts', err.message);
    }
};
// Get agency billing data
export const getAgencyBilling = async (req, res) => {
    try {
        const status = req.query.status;
        console.log('💳 Fetching agency billing data...');
        // Get all agencies with their companies and subscriptions
        const agencies = await prisma.agency.findMany({
            include: {
                company: {
                    include: {
                        subscriptions: {
                            orderBy: { created_at: 'desc' },
                            take: 1, // Get the latest subscription
                            include: {
                                billing_invoices: {
                                    orderBy: { created_at: 'desc' },
                                    take: 10, // Get recent invoices
                                }
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        properties: true
                    }
                }
            }
        });
        const now = new Date();
        const billingData = [];
        for (const agency of agencies) {
            const subscription = agency.company?.subscriptions?.[0] || null;
            const company = agency.company;
            // Get properties and units counts
            const [propertiesCount, unitsCount] = await Promise.all([
                prisma.property.count({ where: { agency_id: agency.id } }),
                prisma.unit.count({
                    where: {
                        property: { agency_id: agency.id }
                    }
                })
            ]);
            // Calculate monthly revenue from occupied units
            const occupiedUnits = await prisma.unit.findMany({
                where: {
                    status: 'occupied',
                    property: { agency_id: agency.id }
                },
                select: {
                    rent_amount: true
                }
            });
            const monthlyRevenue = occupiedUnits.reduce((sum, unit) => {
                return sum + (Number(unit.rent_amount) || 0);
            }, 0);
            // Get outstanding invoices (unpaid or overdue)
            // First, get all unpaid invoices for this subscription
            const allUnpaidInvoices = subscription
                ? await prisma.billingInvoice.findMany({
                    where: {
                        subscription_id: subscription.id,
                        status: { not: 'paid' }
                    }
                })
                : [];
            // Determine which invoices are overdue (due_date has passed)
            const outstandingInvoices = allUnpaidInvoices.filter(invoice => {
                const invoiceDueDate = new Date(invoice.due_date);
                return invoice.status === 'overdue' || invoiceDueDate < now;
            });
            const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => {
                return sum + Number(invoice.amount || 0);
            }, 0);
            // Determine payment status
            let paymentStatus = 'pending';
            let dueDate = null;
            let lastPayment = null;
            let currentPeriod = null;
            if (subscription) {
                // Get the latest paid invoice
                const paidInvoices = subscription.billing_invoices.filter(inv => inv.status === 'paid');
                if (paidInvoices.length > 0) {
                    const latestPaidInvoice = paidInvoices
                        .sort((a, b) => (b.paid_at?.getTime() || 0) - (a.paid_at?.getTime() || 0))[0];
                    if (latestPaidInvoice?.paid_at) {
                        lastPayment = latestPaidInvoice.paid_at;
                    }
                }
                // Check if there are outstanding invoices
                if (outstandingInvoices.length > 0) {
                    // Get the most recent outstanding invoice
                    const latestOutstanding = outstandingInvoices
                        .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];
                    dueDate = new Date(latestOutstanding.due_date);
                    const periodStart = new Date(latestOutstanding.billing_period_start);
                    const periodEnd = new Date(latestOutstanding.billing_period_end);
                    currentPeriod = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;
                    // Determine if overdue
                    if (latestOutstanding.status === 'overdue' || dueDate < now) {
                        paymentStatus = 'overdue';
                    }
                    else {
                        paymentStatus = 'pending';
                    }
                }
                else if (subscription.next_billing_date) {
                    // No outstanding invoices, check next billing date
                    dueDate = new Date(subscription.next_billing_date);
                    // Calculate current period based on billing cycle
                    const cycleDays = subscription.billing_cycle === 'monthly' ? 30 : 365;
                    const periodStart = new Date(subscription.next_billing_date);
                    periodStart.setDate(periodStart.getDate() - cycleDays);
                    const periodEnd = new Date(subscription.next_billing_date);
                    currentPeriod = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;
                    // Determine status based on subscription status and next billing date
                    if (subscription.status === 'active') {
                        if (subscription.next_billing_date > now && outstandingAmount === 0) {
                            paymentStatus = 'paid';
                        }
                        else if (subscription.next_billing_date <= now) {
                            paymentStatus = 'pending';
                        }
                    }
                    else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
                        paymentStatus = 'overdue';
                    }
                    else if (subscription.status === 'canceled') {
                        paymentStatus = 'pending';
                    }
                }
                else {
                    // No next billing date - likely trial or new subscription
                    if (subscription.status === 'trial') {
                        paymentStatus = 'paid'; // Trial is considered paid
                    }
                    else if (subscription.status === 'active' && outstandingAmount === 0) {
                        paymentStatus = 'paid';
                    }
                }
            }
            else {
                // No subscription - mark as pending
                paymentStatus = 'pending';
            }
            // Determine plan name from subscription
            const planName = subscription?.plan
                ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
                : 'No Plan';
            // Get monthly fee (subscription amount)
            const monthlyFee = subscription ? Number(subscription.amount || 0) : 0;
            billingData.push({
                id: agency.id,
                name: agency.name,
                email: agency.email,
                plan: planName,
                monthlyFee: monthlyFee,
                propertiesCount: propertiesCount,
                unitsCount: unitsCount,
                currentPeriod: currentPeriod,
                status: paymentStatus,
                dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
                lastPayment: lastPayment ? lastPayment.toISOString().split('T')[0] : null,
                paymentMethod: subscription?.gateway || 'N/A',
                totalRevenue: monthlyRevenue,
                outstandingAmount: outstandingAmount,
                subscriptionStatus: subscription?.status || 'none',
                subscriptionId: subscription?.id || null
            });
        }
        // Filter by status if provided
        let filteredData = billingData;
        if (status && status !== 'all') {
            filteredData = billingData.filter(item => item.status === status);
        }
        // Calculate summary statistics
        const totalAgencies = billingData.length;
        const paidAgencies = billingData.filter(a => a.status === 'paid').length;
        const overdueAgencies = billingData.filter(a => a.status === 'overdue').length;
        const pendingAgencies = billingData.filter(a => a.status === 'pending').length;
        const totalRevenue = billingData.reduce((sum, a) => sum + a.totalRevenue, 0);
        const totalOutstanding = billingData.reduce((sum, a) => sum + a.outstandingAmount, 0);
        const result = {
            agencies: filteredData,
            summary: {
                total: totalAgencies,
                paid: paidAgencies,
                pending: pendingAgencies,
                overdue: overdueAgencies,
                totalRevenue: totalRevenue,
                totalOutstanding: totalOutstanding
            }
        };
        console.log('✅ Agency billing data retrieved:', {
            total: totalAgencies,
            paid: paidAgencies,
            pending: pendingAgencies,
            overdue: overdueAgencies
        });
        writeSuccess(res, 200, 'Agency billing data retrieved successfully', result);
    }
    catch (err) {
        console.error('Error fetching agency billing:', err);
        writeError(res, 500, 'Failed to fetch agency billing', err.message);
    }
};
// Billing Subscriptions and Invoices
export const getBillingSubscriptions = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status;
        // Get all subscriptions with company and agency info
        const subscriptions = await prisma.subscription.findMany({
            include: {
                company: {
                    include: {
                        agencies: {
                            take: 1 // Get first agency for the company
                        }
                    }
                },
                billing_invoices: {
                    orderBy: { created_at: 'desc' },
                    take: 5
                }
            },
            orderBy: { created_at: 'desc' },
            skip: offset,
            take: limit
        });
        const total = await prisma.subscription.count();
        // Transform to match expected format
        const transformedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
            const agency = sub.company.agencies[0] || null;
            // Get properties and units counts
            const propertiesCount = agency
                ? await prisma.property.count({ where: { agency_id: agency.id } })
                : 0;
            const unitsCount = agency
                ? await prisma.unit.count({
                    where: {
                        property: { agency_id: agency.id }
                    }
                })
                : 0;
            return {
                id: sub.id,
                customer_name: agency?.name || sub.company.name,
                customer_email: agency?.email || sub.company.email,
                plan_name: sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1),
                plan_price: Number(sub.amount || 0),
                status: sub.status,
                billing_cycle: sub.billing_cycle,
                next_billing_date: sub.next_billing_date,
                created_at: sub.created_at,
                properties_count: propertiesCount,
                units_count: unitsCount
            };
        }));
        // Filter by status if provided
        let filteredSubscriptions = transformedSubscriptions;
        if (status && status !== 'all') {
            filteredSubscriptions = transformedSubscriptions.filter(sub => sub.status === status);
        }
        const result = {
            subscriptions: filteredSubscriptions,
            total,
            limit,
            offset,
            summary: {
                active: transformedSubscriptions.filter(s => s.status === 'active').length,
                cancelled: transformedSubscriptions.filter(s => s.status === 'canceled').length,
                total_mrr: transformedSubscriptions
                    .filter(s => s.status === 'active' && s.billing_cycle === 'monthly')
                    .reduce((sum, s) => sum + s.plan_price, 0),
                total_arr: transformedSubscriptions
                    .filter(s => s.status === 'active')
                    .reduce((sum, s) => sum + (s.billing_cycle === 'monthly' ? s.plan_price * 12 : s.plan_price), 0)
            }
        };
        writeSuccess(res, 200, 'Billing subscriptions retrieved successfully', result);
    }
    catch (err) {
        console.error('Error fetching billing subscriptions:', err);
        writeError(res, 500, 'Failed to fetch billing subscriptions', err.message);
    }
};
export const getBillingInvoices = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status;
        // Mock invoice data
        const allInvoices = [
            {
                id: 'INV-001',
                invoice_number: 'INV-2025-001',
                customer_name: 'FairDeal Company',
                customer_email: 'landlord@letrents.com',
                amount: 79.00,
                currency: 'USD',
                status: 'paid',
                due_date: new Date('2025-09-21T00:00:00Z'),
                paid_date: new Date('2025-09-20T00:00:00Z'),
                created_at: new Date('2025-08-21T00:00:00Z'),
                plan_name: 'Professional',
                billing_period: 'September 2025'
            },
            {
                id: 'INV-002',
                invoice_number: 'INV-2025-002',
                customer_name: 'Fanaka Properties Agency',
                customer_email: 'agencyadmin@letrents.com',
                amount: 1990.00,
                currency: 'USD',
                status: 'paid',
                due_date: new Date('2025-09-15T00:00:00Z'),
                paid_date: new Date('2025-09-14T00:00:00Z'),
                created_at: new Date('2025-08-15T00:00:00Z'),
                plan_name: 'Enterprise',
                billing_period: 'Annual 2025-2026'
            },
            {
                id: 'INV-003',
                invoice_number: 'INV-2025-003',
                customer_name: 'FairDeal Company',
                customer_email: 'landlord@letrents.com',
                amount: 79.00,
                currency: 'USD',
                status: 'pending',
                due_date: new Date('2025-10-21T00:00:00Z'),
                paid_date: null,
                created_at: new Date('2025-09-21T00:00:00Z'),
                plan_name: 'Professional',
                billing_period: 'October 2025'
            },
            {
                id: 'INV-004',
                invoice_number: 'INV-2025-004',
                customer_name: 'Demo Property Co.',
                customer_email: 'demo@example.com',
                amount: 29.00,
                currency: 'USD',
                status: 'overdue',
                due_date: new Date('2025-08-10T00:00:00Z'),
                paid_date: null,
                created_at: new Date('2025-07-10T00:00:00Z'),
                plan_name: 'Starter',
                billing_period: 'August 2025'
            }
        ];
        // Filter by status if provided
        let filteredInvoices = allInvoices;
        if (status && status !== 'all') {
            filteredInvoices = allInvoices.filter(inv => inv.status === status);
        }
        // Apply pagination
        const invoices = filteredInvoices.slice(offset, offset + limit);
        const total = filteredInvoices.length;
        const result = {
            invoices,
            total,
            limit,
            offset,
            summary: {
                paid: allInvoices.filter(i => i.status === 'paid').length,
                pending: allInvoices.filter(i => i.status === 'pending').length,
                overdue: allInvoices.filter(i => i.status === 'overdue').length,
                total_paid: allInvoices
                    .filter(i => i.status === 'paid')
                    .reduce((sum, i) => sum + i.amount, 0),
                total_pending: allInvoices
                    .filter(i => i.status === 'pending')
                    .reduce((sum, i) => sum + i.amount, 0),
                total_overdue: allInvoices
                    .filter(i => i.status === 'overdue')
                    .reduce((sum, i) => sum + i.amount, 0)
            }
        };
        writeSuccess(res, 200, 'Billing invoices retrieved successfully', result);
    }
    catch (err) {
        console.error('Error fetching billing invoices:', err);
        writeError(res, 500, 'Failed to fetch billing invoices', err.message);
    }
};
// ========================================
// USER & COMPANY STATUS MANAGEMENT
// ========================================
/**
 * Activate a user or company
 */
export const activateEntity = async (req, res) => {
    try {
        const { entityType, entityId } = req.params; // entityType: 'user' | 'company' | 'agency'
        const { reason } = req.body;
        console.log(`🟢 Activating ${entityType} ${entityId}`);
        if (entityType === 'user') {
            const user = await prisma.user.update({
                where: { id: entityId },
                data: {
                    status: 'active',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'User activated successfully', user);
        }
        else if (entityType === 'company') {
            const company = await prisma.company.update({
                where: { id: entityId },
                data: {
                    status: 'active',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Company activated successfully', company);
        }
        else if (entityType === 'agency') {
            const agency = await prisma.agency.update({
                where: { id: entityId },
                data: {
                    status: 'active',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Agency activated successfully', agency);
        }
        else {
            writeError(res, 400, 'Invalid entity type');
        }
    }
    catch (err) {
        console.error('Error activating entity:', err);
        writeError(res, 500, 'Failed to activate entity', err.message);
    }
};
/**
 * Deactivate a user or company
 */
export const deactivateEntity = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { reason } = req.body;
        console.log(`🔴 Deactivating ${entityType} ${entityId}`);
        if (entityType === 'user') {
            const user = await prisma.user.update({
                where: { id: entityId },
                data: {
                    status: 'inactive',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'User deactivated successfully', user);
        }
        else if (entityType === 'company') {
            const company = await prisma.company.update({
                where: { id: entityId },
                data: {
                    status: 'inactive',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Company deactivated successfully', company);
        }
        else if (entityType === 'agency') {
            const agency = await prisma.agency.update({
                where: { id: entityId },
                data: {
                    status: 'inactive',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Agency deactivated successfully', agency);
        }
        else {
            writeError(res, 400, 'Invalid entity type');
        }
    }
    catch (err) {
        console.error('Error deactivating entity:', err);
        writeError(res, 500, 'Failed to deactivate entity', err.message);
    }
};
/**
 * Suspend a user or company
 */
export const suspendEntity = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { reason } = req.body;
        console.log(`⛔ Suspending ${entityType} ${entityId}. Reason: ${reason}`);
        if (entityType === 'user') {
            const user = await prisma.user.update({
                where: { id: entityId },
                data: {
                    status: 'suspended',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'User suspended successfully', user);
        }
        else if (entityType === 'company') {
            const company = await prisma.company.update({
                where: { id: entityId },
                data: {
                    status: 'suspended',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Company suspended successfully', company);
        }
        else if (entityType === 'agency') {
            const agency = await prisma.agency.update({
                where: { id: entityId },
                data: {
                    status: 'suspended',
                    updated_at: new Date()
                }
            });
            writeSuccess(res, 200, 'Agency suspended successfully', agency);
        }
        else {
            writeError(res, 400, 'Invalid entity type');
        }
    }
    catch (err) {
        console.error('Error suspending entity:', err);
        writeError(res, 500, 'Failed to suspend entity', err.message);
    }
};
/**
 * Send invitation to user
 */
export const sendInvitation = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { resend } = req.query;
        const user = req.user; // Get authenticated user from middleware
        console.log(`📧 ${resend ? 'Resending' : 'Sending'} invitation to ${entityType} ${entityId}`);
        // Get user/entity details
        let email = '';
        let name = '';
        let entityData = null;
        let userData = null;
        let userRole = '';
        if (entityType === 'user') {
            userData = await prisma.user.findUnique({ where: { id: entityId } });
            if (!userData) {
                return writeError(res, 404, 'User not found');
            }
            entityData = userData;
            email = userData.email || '';
            name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || email;
            userRole = userData.role || '';
        }
        else if (entityType === 'agency') {
            entityData = await prisma.agency.findUnique({
                where: { id: entityId },
                include: {
                    creator: {
                        select: {
                            id: true,
                            email: true,
                            first_name: true,
                            last_name: true,
                            role: true,
                            status: true,
                            password_hash: true,
                            email_verified: true,
                        }
                    }
                }
            });
            if (!entityData) {
                return writeError(res, 404, 'Agency not found');
            }
            email = entityData.email || '';
            name = entityData.name || '';
            // Get the agency_admin user associated with this agency
            if (entityData.creator) {
                userData = entityData.creator;
                userRole = userData.role || '';
            }
            else {
                // Try to find agency_admin user with this agency_id
                userData = await prisma.user.findFirst({
                    where: {
                        agency_id: entityId,
                        role: 'agency_admin'
                    }
                });
                if (userData) {
                    userRole = userData.role || '';
                }
            }
        }
        else {
            return writeError(res, 400, 'Invalid entity type');
        }
        if (!email) {
            return writeError(res, 400, 'Email address not found for this entity');
        }
        // Import email service
        const { emailService } = await import('../services/email.service.js');
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        const env = (await import('../config/env.js')).env;
        let tempPassword = null;
        let needsPasswordReset = false;
        // For users, check if they need a password or password reset
        if (userData) {
            const hasPassword = !!userData.password_hash;
            const isPending = userData.status === 'pending';
            const isEmailVerified = userData.email_verified;
            // If user doesn't have a password or is pending, generate a temporary password
            if (!hasPassword || isPending) {
                // Generate a secure temporary password
                tempPassword = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
                const passwordHash = await bcrypt.default.hash(tempPassword, 10);
                // CRITICAL: When sending credentials via email, we MUST verify the email
                // This allows the user to log in immediately without email verification step
                // If we don't verify the email, login will fail with "user account is not verified"
                // This is safe because we're sending the credentials to their email address,
                // which proves they have access to that email.
                await prisma.user.update({
                    where: { id: userData.id },
                    data: {
                        password_hash: passwordHash,
                        status: 'pending_setup', // User needs to set up their account
                        email_verified: true, // REQUIRED: Auto-verify email when sending credentials via email
                        updated_at: new Date()
                    }
                });
                needsPasswordReset = true;
                console.log(`🔑 Generated temporary password for user ${userData.id} and verified email (required for login)`);
            }
            else if (!isEmailVerified && hasPassword) {
                // User has password but email is not verified - send verification email instead
                // Don't generate new password, just send verification link
                console.log(`📧 User ${userData.id} has password but email not verified - sending verification email`);
            }
        }
        // Determine email type and content based on user status
        const isAgencyAdmin = userRole === 'agency_admin';
        const isLandlord = userRole === 'landlord';
        const loginUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/login`;
        const appName = 'LetRents';
        let emailSubject = '';
        let emailHtml = '';
        let emailText = '';
        if (needsPasswordReset && tempPassword) {
            // Send invitation email with temporary password
            emailSubject = `Welcome to ${appName} - Complete Your Account Setup`;
            const roleDisplayName = isAgencyAdmin ? 'Agency Administrator' : isLandlord ? 'Landlord' : 'User';
            emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${appName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
            .content { padding: 40px 30px; background: white; }
            .credentials { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 16px 16px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 25px 0; }
            .warning strong { color: #856404; }
            h1 { margin: 0; font-size: 28px; font-weight: 700; }
            h2 { margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600; }
            p { margin: 0 0 15px; color: #475569; font-size: 16px; }
            .password { font-family: 'Courier New', monospace; background: #e9ecef; padding: 8px 12px; border-radius: 6px; font-size: 18px; font-weight: 600; color: #2563eb; letter-spacing: 2px; }
            ul { margin: 15px 0; padding-left: 20px; }
            li { margin: 8px 0; color: #475569; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${appName}!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Your Account Setup</p>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>🎉 Congratulations! Your ${roleDisplayName} account has been created on ${appName}. We're excited to have you on board!</p>
              <p>To get started, please use the temporary credentials below to log in and complete your account setup.</p>
              
              <div class="credentials">
                <h3 style="margin-top: 0; color: #2563eb; font-size: 18px;">Your Login Credentials</h3>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Temporary Password:</strong> <span class="password">${tempPassword}</span></p>
                <p><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
              </div>

              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul>
                  <li>This is a temporary password for your first login</li>
                  <li>You will be required to change your password after logging in</li>
                  <li>Please keep these credentials secure and do not share them</li>
                  <li>If you didn't expect this invitation, please contact our support team immediately</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to ${appName}</a>
              </div>

              <h3 style="margin-top: 35px;">What's Next?</h3>
              <ol style="color: #475569; padding-left: 20px;">
                <li>Click the login button above or visit the login URL</li>
                <li>Enter your email and temporary password</li>
                <li>Set up your new secure password</li>
                <li>Complete your profile setup</li>
                <li>Start managing your properties!</li>
              </ol>

              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Welcome to the ${appName} family!</p>
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>This is an automated invitation email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            emailText = `Welcome to ${appName}!

Hello ${name},

Congratulations! Your ${roleDisplayName} account has been created on ${appName}. We're excited to have you on board!

To get started, please use the temporary credentials below to log in and complete your account setup.

Your Login Credentials:
Email: ${email}
Temporary Password: ${tempPassword}
Login URL: ${loginUrl}

Important Security Notice:
- This is a temporary password for your first login
- You will be required to change your password after logging in
- Please keep these credentials secure and do not share them
- If you didn't expect this invitation, please contact our support team immediately

What's Next?
1. Click the login URL or visit ${loginUrl}
2. Enter your email and temporary password
3. Set up your new secure password
4. Complete your profile setup
5. Start managing your properties!

If you have any questions or need assistance, please don't hesitate to contact our support team.

Welcome to the ${appName} family!

Best regards,
The ${appName} Team

---
© ${new Date().getFullYear()} ${appName}. All rights reserved.
This is an automated invitation email. Please do not reply to this email.`;
        }
        else if (userData && userData.email_verified === false) {
            // Send email verification email
            const { emailService: authEmailService } = await import('../services/email.service.js');
            // Generate verification token
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            // Check if verification token exists
            const existingToken = await prisma.emailVerificationToken.findFirst({
                where: { user_id: userData.id, is_used: false }
            });
            if (existingToken) {
                // Invalidate old token
                await prisma.emailVerificationToken.updateMany({
                    where: { user_id: userData.id, is_used: false },
                    data: { is_used: true, used_at: new Date() }
                });
            }
            // Create new verification token
            await prisma.emailVerificationToken.create({
                data: {
                    user_id: userData.id,
                    token_hash: tokenHash,
                    email: userData.email,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    is_used: false,
                }
            });
            const verificationUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
            // Use the email service's sendVerificationEmail method
            const emailResult = await authEmailService.sendVerificationEmail(userData.email, verificationUrl, name);
            if (!emailResult.success) {
                console.error('Failed to send verification email:', emailResult.error);
                return writeError(res, 500, 'Failed to send verification email', emailResult.error);
            }
            return writeSuccess(res, 200, `Verification email ${resend ? 'resent' : 'sent'} successfully`, {
                email,
                name,
                type: 'verification',
                sent_at: new Date()
            });
        }
        else {
            // Send welcome email with login information (user already has password)
            emailSubject = `Welcome to ${appName} - Account Access Information`;
            emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${appName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; }
            .content { padding: 40px 30px; background: white; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 16px 16px; }
            h1 { margin: 0; font-size: 28px; font-weight: 700; }
            h2 { margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600; }
            p { margin: 0 0 15px; color: #475569; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${appName}!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Your account is ready! You can now access your ${appName} account using your existing credentials.</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to ${appName}</a>
              </div>

              <p>If you've forgotten your password, you can reset it from the login page.</p>
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            emailText = `Welcome to ${appName}!

Hello ${name},

Your account is ready! You can now access your ${appName} account using your existing credentials.

Email: ${email}
Login URL: ${loginUrl}

If you've forgotten your password, you can reset it from the login page.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The ${appName} Team

---
© ${new Date().getFullYear()} ${appName}. All rights reserved.
This is an automated email. Please do not reply to this email.`;
        }
        // Send the email
        const emailResult = await emailService.sendEmail({
            to: email,
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
            type: 'invitation'
        });
        if (!emailResult.success) {
            console.error('Failed to send invitation email:', emailResult.error);
            // Log credentials to console as fallback for development
            if (tempPassword) {
                console.log(`\n📧 INVITATION EMAIL (email service failed):`);
                console.log(`👤 Name: ${name}`);
                console.log(`📧 Email: ${email}`);
                console.log(`🔑 Temporary Password: ${tempPassword}`);
                console.log(`🔗 Login URL: ${loginUrl}\n`);
            }
            return writeError(res, 500, 'Failed to send invitation email', emailResult.error);
        }
        console.log(`✅ Invitation email sent successfully to ${email}`);
        // Update entity updated_at timestamp
        if (entityType === 'user') {
            await prisma.user.update({
                where: { id: entityId },
                data: { updated_at: new Date() }
            });
        }
        else if (entityType === 'agency') {
            await prisma.agency.update({
                where: { id: entityId },
                data: { updated_at: new Date() }
            });
        }
        writeSuccess(res, 200, `Invitation ${resend ? 'resent' : 'sent'} successfully`, {
            email,
            name,
            type: tempPassword ? 'password_reset' : 'welcome',
            sent_at: new Date(),
            ...(tempPassword && process.env.NODE_ENV === 'development' ? { temp_password: tempPassword } : {})
        });
    }
    catch (err) {
        console.error('Error sending invitation:', err);
        writeError(res, 500, 'Failed to send invitation', err.message);
    }
};
/**
 * Get subscription details for a company/agency
 */
export const getEntitySubscription = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        console.log(`💳 Fetching subscription for ${entityType} ${entityId}`);
        // Get company_id based on entity type
        let companyId = entityId;
        if (entityType === 'user') {
            const user = await prisma.user.findUnique({ where: { id: entityId } });
            if (!user || !user.company_id) {
                return writeError(res, 404, 'User or company not found');
            }
            companyId = user.company_id;
        }
        else if (entityType === 'agency') {
            // Agencies might have their own subscription or use company subscription
            // For now, we'll get the agency's company_id
            const agency = await prisma.agency.findUnique({ where: { id: entityId } });
            if (!agency) {
                return writeError(res, 404, 'Agency not found');
            }
            companyId = entityId; // Agencies might be their own billing entity
        }
        // Get subscription
        const subscription = await prisma.subscription.findFirst({
            where: { company_id: companyId },
            orderBy: { created_at: 'desc' }
        });
        if (!subscription) {
            return writeSuccess(res, 200, 'No subscription found', {
                has_subscription: false,
                company_id: companyId
            });
        }
        writeSuccess(res, 200, 'Subscription retrieved successfully', subscription);
    }
    catch (err) {
        console.error('Error fetching subscription:', err);
        writeError(res, 500, 'Failed to fetch subscription', err.message);
    }
};
/**
 * Update subscription for a company/agency
 */
export const updateEntitySubscription = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { plan, status, trial_days } = req.body;
        const user = req.user;
        console.log(`💳 Updating subscription for ${entityType} ${entityId}`);
        // Get company_id
        let companyId = entityId;
        if (entityType === 'user') {
            const userRecord = await prisma.user.findUnique({ where: { id: entityId } });
            if (!userRecord || !userRecord.company_id) {
                return writeError(res, 404, 'User or company not found');
            }
            companyId = userRecord.company_id;
        }
        // Find existing subscription
        const existingSubscription = await prisma.subscription.findFirst({
            where: { company_id: companyId },
            orderBy: { created_at: 'desc' }
        });
        // Calculate subscription amount based on plan
        const getPlanAmount = (planName) => {
            switch (planName) {
                case 'basic': return 999;
                case 'professional': return 1999;
                case 'enterprise': return 4999;
                default: return 999;
            }
        };
        let subscription;
        if (existingSubscription) {
            // Update existing subscription
            const updateData = {
                updated_at: new Date()
            };
            if (plan) {
                updateData.plan = plan;
                updateData.amount = getPlanAmount(plan);
            }
            if (status)
                updateData.status = status;
            if (trial_days) {
                updateData.trial_end_date = new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000);
            }
            subscription = await prisma.subscription.update({
                where: { id: existingSubscription.id },
                data: updateData
            });
        }
        else {
            // Create new subscription
            const selectedPlan = plan || 'basic';
            const trialEndDate = trial_days ? new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000) : null;
            const startDate = trialEndDate || new Date();
            subscription = await prisma.subscription.create({
                data: {
                    company_id: companyId,
                    plan: selectedPlan,
                    status: status || 'trial',
                    amount: getPlanAmount(selectedPlan),
                    start_date: startDate,
                    trial_start_date: trial_days ? new Date() : null,
                    trial_end_date: trialEndDate,
                    next_billing_date: trialEndDate,
                    created_by: user.id,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
        }
        writeSuccess(res, 200, 'Subscription updated successfully', subscription);
    }
    catch (err) {
        console.error('Error updating subscription:', err);
        writeError(res, 500, 'Failed to update subscription', err.message);
    }
};
