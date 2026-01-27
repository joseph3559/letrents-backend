import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { writeSuccess, writeError } from '../utils/response.js';
import bcrypt from 'bcryptjs';
import { JWTClaims } from '../types/index.js';

const prisma = new PrismaClient();

// Dashboard and Analytics
export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // Extract date range filter from query parameters
    const dateRange = req.query.date_range as string || '30d';
    
    // Calculate start date based on date range filter
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
    }
    
    // Get system-wide statistics using raw SQL to avoid enum issues
    const [
      agenciesResult,
      landlordsResult,
      propertiesResult,
      unitsResult,
      usersResult,
      activeTenantsResult,
      rentRevenueResult,
      subscriptionRevenueResult
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM agencies`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'landlord'::user_role`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM properties`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count, status FROM units GROUP BY status`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count, role FROM users GROUP BY role`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'tenant'::user_role AND status = 'active'::user_status`,
      // Rental Revenue: Sum of ALL payments landlords/agencies receive from tenants
      // Includes: rent, utilities, maintenance, late fees, penalties, security deposits, etc.
      // This is all tenant-to-landlord/agency payments (all payment types)
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount), 0)::numeric as total 
        FROM payments 
        WHERE status IN ('approved'::payment_status, 'completed'::payment_status)
          AND payment_date >= ${startDate}::timestamp
      `,
      // Subscription Revenue: Sum of subscription payments platform receives from landlords/agencies
      // This includes:
      // 1. Paid billing_invoices (recurring subscription payments)
      // 2. Subscriptions created from direct payments (initial subscription payments)
      // We need to combine both sources
      prisma.$queryRaw`
        SELECT COALESCE(
          (
            SELECT COALESCE(SUM(amount), 0)::numeric 
            FROM billing_invoices 
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
              AND paid_at >= ${startDate}::timestamp
          ) +
          (
            SELECT COALESCE(SUM(amount), 0)::numeric 
            FROM subscriptions 
            WHERE status IN ('active'::subscription_status, 'trial'::subscription_status)
              AND metadata->>'created_from_payment' = 'true'
              AND created_at >= ${startDate}::timestamp
          ),
          0
        )::numeric as total
      `
    ]);

    const agencies = Array.isArray(agenciesResult) ? Number((agenciesResult[0] as any)?.count || 0) : 0;
    const landlords = Array.isArray(landlordsResult) ? Number((landlordsResult[0] as any)?.count || 0) : 0;
    // Total companies is the sum of agencies and landlords
    const companies = agencies + landlords;
    const properties = Array.isArray(propertiesResult) ? Number((propertiesResult[0] as any)?.count || 0) : 0;
    
    const unitsData = Array.isArray(unitsResult) ? unitsResult as any[] : [];
    const totalUnits = unitsData.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const occupiedUnits = unitsData.find(item => item.status === 'occupied')?.count || 0;
    const vacantUnits = unitsData.find(item => item.status === 'vacant')?.count || 0;
    
    const usersData = Array.isArray(usersResult) ? usersResult as any[] : [];
    const totalUsers = usersData.reduce((sum, item) => sum + Number(item.count || 0), 0);
    
    const activeTenants = Array.isArray(activeTenantsResult) ? Number((activeTenantsResult[0] as any)?.count || 0) : 0;
    const rentRevenue = Array.isArray(rentRevenueResult) ? Number((rentRevenueResult[0] as any)?.total || 0) : 0;
    const subscriptionRevenue = Array.isArray(subscriptionRevenueResult) ? Number((subscriptionRevenueResult[0] as any)?.total || 0) : 0;
    
    // Debug: Check billing invoices and subscriptions to understand subscription revenue
    const debugBillingInvoices = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*)::int FROM billing_invoices) as billing_invoices_total,
        (SELECT COUNT(*)::int FROM billing_invoices WHERE status = 'paid') as billing_invoices_paid,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM billing_invoices WHERE status = 'paid' AND paid_at IS NOT NULL AND paid_at >= ${startDate}::timestamp) as billing_invoices_amount,
        (SELECT COUNT(*)::int FROM subscriptions) as subscriptions_total,
        (SELECT COUNT(*)::int FROM subscriptions WHERE status IN ('active'::subscription_status, 'trial'::subscription_status) AND metadata->>'created_from_payment' = 'true') as subscriptions_from_payment,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM subscriptions WHERE status IN ('active'::subscription_status, 'trial'::subscription_status) AND (metadata->>'created_from_payment')::text = 'true' AND created_at >= ${startDate}::timestamp) as subscriptions_amount
    `;
    
    const debug = Array.isArray(debugBillingInvoices) ? debugBillingInvoices[0] : {};
    
    const monthlyRevenue = rentRevenue + subscriptionRevenue;
    
    // Debug logging to verify calculations
    console.log('📊 Revenue Calculations:', {
      dateRange,
      startDate: startDate.toISOString(),
      rentRevenue,
      subscriptionRevenue,
      monthlyRevenue,
      rentRevenueSource: 'payments table (ALL tenant payments: rent, utilities, fees, etc.)',
      subscriptionRevenueSource: 'billing_invoices table (platform subscription fees from companies)',
      debugBillingInvoices: debug
    });

    // Get recent activities from multiple sources (users, billing invoices, payments)
    const [userActivities, billingActivities, paymentActivities] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          id::text,
          'user_created' as type,
          CONCAT('User ', first_name, ' ', last_name, ' (', role, ') created') as description,
          created_at as timestamp,
          email as user_email,
          role as metadata
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC 
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT 
          bi.id::text,
          'subscription_payment' as type,
          CONCAT('Subscription payment: ', bi.invoice_number, ' - KES ', bi.amount) as description,
          COALESCE(bi.paid_at, bi.created_at) as timestamp,
          c.email as user_email,
          bi.status as metadata
        FROM billing_invoices bi
        JOIN companies c ON bi.company_id = c.id
        WHERE (bi.status = 'paid' OR bi.created_at >= NOW() - INTERVAL '7 days')
        ORDER BY COALESCE(bi.paid_at, bi.created_at) DESC 
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT 
          p.id::text,
          'payment_received' as type,
          CONCAT('Payment received: ', p.receipt_number, ' - KES ', p.amount) as description,
          COALESCE(p.payment_date, p.created_at) as timestamp,
          u.email as user_email,
          p.status as metadata
        FROM payments p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.status = 'approved' AND p.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY COALESCE(p.payment_date, p.created_at) DESC 
        LIMIT 5
      `
    ]);

    // Combine and sort all activities by timestamp
    const allActivities = [
      ...(Array.isArray(userActivities) ? userActivities : []),
      ...(Array.isArray(billingActivities) ? billingActivities : []),
      ...(Array.isArray(paymentActivities) ? paymentActivities : [])
    ].sort((a: any, b: any) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    }).slice(0, 10);

    const recentActivities = allActivities;

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
        total_landlords: landlords,
        total_properties: properties,
        total_units: totalUnits,
        active_units: Number(occupiedUnits),
        vacant_units: Number(vacantUnits),
        total_users: totalUsers,
        active_tenants: activeTenants,
        monthly_revenue: monthlyRevenue, // Total revenue (for backward compatibility)
        subscription_revenue: subscriptionRevenue, // Subscription revenue
        rental_revenue: rentRevenue, // Rental revenue from occupied units
        ytd_revenue: monthlyRevenue * 12, // Simplified calculation
        occupancy_rate: totalUnits > 0 ? Math.round((Number(occupiedUnits) / totalUnits) * 100) : 0,
      },
      recent_activities: recentActivities,
      system_alerts: systemAlerts,
    };

    writeSuccess(res, 200, 'Dashboard data retrieved successfully', dashboardData);
  } catch (err: any) {
    console.error('Error fetching dashboard data:', err);
    writeError(res, 500, 'Failed to fetch dashboard data', err.message);
  }
};

export const getKPIMetrics = async (req: Request, res: Response) => {
  try {
    const [
      rentRevenue,
      subscriptionRevenue,
      totalProperties,
      totalTenants,
      occupancyData
    ] = await Promise.all([
      // Rental Revenue: Sum of ALL payments landlords/agencies receive from tenants
      // Includes: rent, utilities, maintenance, late fees, penalties, security deposits, etc.
      // This is all tenant-to-landlord/agency payments (all payment types)
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount), 0)::numeric as total 
        FROM payments 
        WHERE status IN ('approved'::payment_status, 'completed'::payment_status)
      `,
      // Subscription Revenue: Sum of subscription payments platform receives from landlords/agencies
      // This includes:
      // 1. Paid billing_invoices (recurring subscription payments)
      // 2. Subscriptions created from direct payments (initial subscription payments)
      prisma.$queryRaw`
        SELECT COALESCE(
          (
            SELECT COALESCE(SUM(amount), 0)::numeric 
            FROM billing_invoices 
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
          ) +
          (
            SELECT COALESCE(SUM(amount), 0)::numeric 
            FROM subscriptions 
            WHERE status IN ('active'::subscription_status, 'trial'::subscription_status)
              AND metadata->>'created_from_payment' = 'true'
          ),
          0
        )::numeric as total
      `,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM properties`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'tenant'::user_role AND status = 'active'::user_status`,
      prisma.$queryRaw`SELECT COUNT(*)::int as total, SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END)::int as occupied FROM units`
    ]);

    const rentRev = Array.isArray(rentRevenue) ? Number((rentRevenue[0] as any)?.total || 0) : 0;
    const subRev = Array.isArray(subscriptionRevenue) ? Number((subscriptionRevenue[0] as any)?.total || 0) : 0;
    const revenue = rentRev + subRev; // Total revenue (for backward compatibility)
    const properties = Array.isArray(totalProperties) ? Number((totalProperties[0] as any)?.count || 0) : 0;
    const tenants = Array.isArray(totalTenants) ? Number((totalTenants[0] as any)?.count || 0) : 0;
    const occupancy = Array.isArray(occupancyData) ? occupancyData[0] as any : { total: 0, occupied: 0 };
    const occupancyRate = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0;

    const kpis = [
      {
        id: '1',
        title: 'Subscription Revenue',
        value: subRev,
        format: 'currency',
        change: '+15.8%',
        trend: 'up' as const,
        period: 'vs last month'
      },
      {
        id: '2',
        title: 'Total Rental Revenue',
        value: rentRev,
        format: 'currency',
        change: '+12.5%',
        trend: 'up' as const,
        period: 'vs last month'
      },
      {
        id: '3',
        title: 'Properties',
        value: properties,
        format: 'number',
        change: '+2',
        trend: 'up' as const,
        period: 'vs last month'
      },
      {
        id: '4',
        title: 'Active Tenants',
        value: tenants,
        format: 'number',
        change: '+8.3%',
        trend: 'up' as const,
        period: 'vs last month'
      },
      {
        id: '5',
        title: 'Occupancy Rate',
        value: occupancyRate,
        format: 'percentage',
        change: '+2.1%',
        trend: 'up' as const,
        period: 'vs last month'
      }
    ];

    writeSuccess(res, 200, 'KPI metrics retrieved successfully', kpis);
  } catch (err: any) {
    console.error('Error fetching KPI metrics:', err);
    writeError(res, 500, 'Failed to fetch KPI metrics', err.message);
  }
};

export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - startTime;

    // Calculate system uptime percentage (assuming 30 days = 100%)
    const uptimeSeconds = process.uptime();
    const uptimeDays = uptimeSeconds / (24 * 60 * 60);
    const uptimePercentage = Math.min(100, Math.round((uptimeDays / 30) * 100 * 100) / 100);

    // Get active users count (users with status = 'active')
    const activeUsersResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE status = 'active'::user_status
    `;
    const activeUsers = Array.isArray(activeUsersResult) ? Number((activeUsersResult[0] as any)?.count || 0) : 0;

    // Estimate API calls from recent user activities (last 7 days)
    // This is an approximation - in production you'd track this in a separate table
    const apiCallsResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE updated_at >= NOW() - INTERVAL '7 days'
    `;
    const recentActivities = Array.isArray(apiCallsResult) ? Number((apiCallsResult[0] as any)?.count || 0) : 0;
    // Estimate daily API calls (multiply by average requests per user per day)
    const estimatedApiCalls = recentActivities * 50; // Rough estimate

    // Calculate error rate from recent errors (check for failed logins or errors in last 24 hours)
    // For now, we'll use a low error rate as we don't have a dedicated error log table
    const errorRate = 0.1; // 0.1% default - would need error tracking to calculate accurately

    const healthData = {
      overall_status: 'healthy' as const,
      services: {
        api: {
          status: 'healthy',
          response_time: 5,
          uptime: uptimePercentage
        },
        database: {
          status: 'healthy',
          connections: 10,
          query_time: dbResponseTime
        },
        storage: {
          status: 'healthy',
          used_space: 0,
          total_space: 0,
          usage_percentage: 0
        },
        payments: {
          status: 'healthy',
          success_rate: 99.9,
          failed_transactions: 0
        }
      },
      performance: {
        uptime_percentage: uptimePercentage,
        active_users: activeUsers,
        api_calls: estimatedApiCalls,
        error_rate: errorRate
      },
      last_updated: new Date().toISOString()
    };

    writeSuccess(res, 200, 'System health retrieved successfully', healthData);
  } catch (err: any) {
    console.error('Error checking system health:', err);
    writeError(res, 500, 'Failed to check system health', err.message);
  }
};

/**
 * Check for landlords and agencies without company_id
 * Diagnostic endpoint to verify data integrity
 */
export const checkCompanyIntegrity = async (req: Request, res: Response) => {
  try {
    console.log('🔍 Checking company integrity for landlords and agencies...');

    // Find landlords without company_id
    const landlordsWithoutCompany = await prisma.user.findMany({
      where: {
        role: 'landlord',
        company_id: { equals: null },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        created_at: true,
      },
    });

    // Find agency_admins without company_id
    const agenciesWithoutCompany = await prisma.user.findMany({
      where: {
        role: 'agency_admin',
        company_id: { equals: null },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        created_at: true,
      },
    });

    // Note: company_id is non-nullable in Agency schema, so this query is not possible
    // If legacy data exists, it would need to be handled via raw SQL
    const agenciesTableWithoutCompany: any[] = [];

    // Find companies without names (checking for empty strings since name is non-nullable)
    const companiesWithoutName = await prisma.company.findMany({
      where: {
        name: '',
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    // Get total counts for context
    const totalLandlords = await prisma.user.count({
      where: { role: 'landlord' },
    });

    const totalAgencies = await prisma.user.count({
      where: { role: 'agency_admin' },
    });

    const totalCompanies = await prisma.company.count();

    const result = {
      status: landlordsWithoutCompany.length === 0 && 
               agenciesWithoutCompany.length === 0 && 
               agenciesTableWithoutCompany.length === 0 &&
               companiesWithoutName.length === 0 ? 'healthy' : 'issues_found',
      summary: {
        total_landlords: totalLandlords,
        total_agency_admins: totalAgencies,
        total_companies: totalCompanies,
        landlords_without_company: landlordsWithoutCompany.length,
        agency_admins_without_company: agenciesWithoutCompany.length,
        agencies_table_without_company: agenciesTableWithoutCompany.length,
        companies_without_name: companiesWithoutName.length,
      },
      issues: {
        landlords_without_company: landlordsWithoutCompany,
        agency_admins_without_company: agenciesWithoutCompany,
        agencies_table_without_company: agenciesTableWithoutCompany,
        companies_without_name: companiesWithoutName,
      },
      recommendation: landlordsWithoutCompany.length > 0 || 
                      agenciesWithoutCompany.length > 0 || 
                      agenciesTableWithoutCompany.length > 0 ||
                      companiesWithoutName.length > 0
        ? 'Run the fix script: npx ts-node src/scripts/fix-landlords-agencies-companies.ts'
        : 'All landlords and agencies have company_id and company names',
    };

    writeSuccess(res, 200, 'Company integrity check completed', result);
  } catch (err: any) {
    console.error('Error checking company integrity:', err);
    writeError(res, 500, 'Failed to check company integrity', err.message);
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const action = req.query.action as string;
    const resource = req.query.resource as string;
    const dateFrom = req.query.date_from as string;

    // Build date filter - default to last 30 days if not specified
    const dateFromFilter = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch user activities
    const userLogs = await prisma.$queryRaw`
      SELECT 
        id::text,
        CONCAT('User ', first_name, ' ', last_name, ' was created') as action,
        email as user_email,
        role as resource,
        'create' as action_type,
        created_at,
        'system' as ip_address,
        NULL::text as resource_id
      FROM users 
      WHERE created_at >= ${dateFromFilter}::timestamp
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Fetch billing invoice activities
    const billingLogs = await prisma.$queryRaw`
      SELECT 
        bi.id::text,
        CASE 
          WHEN bi.status = 'paid' THEN 'Subscription payment received'
          ELSE 'Subscription invoice created'
        END as action,
        c.email as user_email,
        'billing_invoice' as resource,
        CASE 
          WHEN bi.status = 'paid' THEN 'subscription_payment'
          ELSE 'subscription_invoice_created'
        END as action_type,
        COALESCE(bi.paid_at, bi.created_at) as created_at,
        'system' as ip_address,
        bi.id::text as resource_id
      FROM billing_invoices bi
      JOIN companies c ON bi.company_id = c.id
      WHERE COALESCE(bi.paid_at, bi.created_at) >= ${dateFromFilter}::timestamp
      ORDER BY COALESCE(bi.paid_at, bi.created_at) DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Fetch payment activities
    const paymentLogs = await prisma.$queryRaw`
      SELECT 
        p.id::text,
        CONCAT('Payment received: ', p.receipt_number) as action,
        COALESCE(u.email, 'System') as user_email,
        'payment' as resource,
        'payment_received' as action_type,
        COALESCE(p.payment_date, p.created_at) as created_at,
        'system' as ip_address,
        p.id::text as resource_id
      FROM payments p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.status = 'approved' AND COALESCE(p.payment_date, p.created_at) >= ${dateFromFilter}::timestamp
      ORDER BY COALESCE(p.payment_date, p.created_at) DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Fetch subscription activities (including newly created subscriptions from payments)
    const subscriptionLogs = await prisma.$queryRaw`
      SELECT 
        s.id::text,
        CASE 
          WHEN (s.metadata->>'created_from_payment')::boolean = true THEN 
            CONCAT('Subscription payment received: ', COALESCE(s.metadata->>'transaction_reference', s.id::text))
          WHEN s.status = 'active' THEN 
            CONCAT('Subscription activated: ', c.name, ' - ', s.plan, ' plan')
          ELSE 
            CONCAT('Subscription ', s.status, ': ', c.name)
        END as action,
        COALESCE(c.email, u.email, 'System') as user_email,
        'subscription' as resource,
        CASE 
          WHEN (s.metadata->>'created_from_payment')::boolean = true THEN 'subscription_payment'
          WHEN s.status = 'active' THEN 'subscription_activated'
          ELSE 'subscription_updated'
        END as action_type,
        COALESCE(s.updated_at, s.created_at) as created_at,
        'system' as ip_address,
        s.id::text as resource_id
      FROM subscriptions s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE COALESCE(s.updated_at, s.created_at) >= ${dateFromFilter}::timestamp
      ORDER BY COALESCE(s.updated_at, s.created_at) DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Combine all logs and sort by date
    const allLogs = [
      ...(Array.isArray(userLogs) ? userLogs : []),
      ...(Array.isArray(billingLogs) ? billingLogs : []),
      ...(Array.isArray(paymentLogs) ? paymentLogs : []),
      ...(Array.isArray(subscriptionLogs) ? subscriptionLogs : []),
    ].sort((a: any, b: any) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    }).slice(0, limit);

    // Get total counts
    const [userCount, billingCount, paymentCount, subscriptionCount] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE created_at >= ${dateFromFilter}::timestamp`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM billing_invoices WHERE COALESCE(paid_at, created_at) >= ${dateFromFilter}::timestamp`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM payments WHERE status = 'approved' AND COALESCE(payment_date, created_at) >= ${dateFromFilter}::timestamp`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM subscriptions WHERE COALESCE(updated_at, created_at) >= ${dateFromFilter}::timestamp`
    ]);

    const totalUsers = Array.isArray(userCount) ? Number((userCount[0] as any)?.count || 0) : 0;
    const totalBilling = Array.isArray(billingCount) ? Number((billingCount[0] as any)?.count || 0) : 0;
    const totalPayments = Array.isArray(paymentCount) ? Number((paymentCount[0] as any)?.count || 0) : 0;
    const totalSubscriptions = Array.isArray(subscriptionCount) ? Number((subscriptionCount[0] as any)?.count || 0) : 0;
    const total = totalUsers + totalBilling + totalPayments + totalSubscriptions;

    const auditData = {
      logs: allLogs,
      total: total,
      page: page,
      limit: limit,
      pages: Math.ceil(total / limit)
    };

    writeSuccess(res, 200, 'Audit logs retrieved successfully', auditData);
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    writeError(res, 500, 'Failed to fetch audit logs', err.message);
  }
};

export const getAnalyticsChart = async (req: Request, res: Response) => {
  try {
    const { chartType } = req.params;
    const period = req.query.period as string || '30d';

    // Calculate date range based on period
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === '1y') days = 365;

    const labels: string[] = [];
    const data: number[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Generate date labels
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toISOString().split('T')[0]);
    }

    // Fetch real data based on chart type
    switch (chartType) {
      case 'revenue': {
        // Get daily revenue from billing invoices and rental revenue
        // Query subscription revenue separately
        const subscriptionRevenueData = await prisma.$queryRaw<any[]>`
          SELECT 
            date.date::date as date,
            COALESCE(SUM(bi.amount), 0)::numeric as subscription_revenue
          FROM generate_series(${startDate}::date, CURRENT_DATE, '1 day'::interval) as date
          LEFT JOIN billing_invoices bi ON DATE(bi.paid_at) = date.date::date AND bi.status = 'paid'
          GROUP BY date.date::date
          ORDER BY date.date::date
        `;

        // Query subscription revenue from direct payments
        const directSubscriptionRevenueData = await prisma.$queryRaw<any[]>`
          SELECT 
            date.date::date as date,
            COALESCE(SUM(s.amount), 0)::numeric as direct_subscription_revenue
          FROM generate_series(${startDate}::date, CURRENT_DATE, '1 day'::interval) as date
          LEFT JOIN subscriptions s ON DATE(s.created_at) = date.date::date 
            AND s.status IN ('active', 'trial')
            AND (s.metadata->>'created_from_payment')::boolean = true
            AND NOT EXISTS (
              SELECT 1 FROM billing_invoices bi2 
              WHERE bi2.subscription_id = s.id 
              AND DATE(bi2.paid_at) = date.date::date
            )
          GROUP BY date.date::date
          ORDER BY date.date::date
        `;

        // Query rental revenue
        const rentalRevenueData = await prisma.$queryRaw<any[]>`
          SELECT 
            date.date::date as date,
            COALESCE(SUM(u.rent_amount), 0)::numeric as rental_revenue
          FROM generate_series(${startDate}::date, CURRENT_DATE, '1 day'::interval) as date
          LEFT JOIN units u ON DATE(u.updated_at) = date.date::date AND u.status = 'occupied'
          GROUP BY date.date::date
          ORDER BY date.date::date
        `;

        // Combine all revenue sources
        const revenueMap = new Map<string, number>();
        
        subscriptionRevenueData.forEach((row: any) => {
          const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : null;
          if (dateStr) {
            revenueMap.set(dateStr, Number(row.subscription_revenue || 0));
          }
        });

        directSubscriptionRevenueData.forEach((row: any) => {
          const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : null;
          if (dateStr) {
            const current = revenueMap.get(dateStr) || 0;
            revenueMap.set(dateStr, current + Number(row.direct_subscription_revenue || 0));
          }
        });

        rentalRevenueData.forEach((row: any) => {
          const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : null;
          if (dateStr) {
            const current = revenueMap.get(dateStr) || 0;
            revenueMap.set(dateStr, current + Number(row.rental_revenue || 0));
          }
        });

        labels.forEach(label => {
          data.push(revenueMap.get(label) || 0);
        });
        break;
      }
      case 'occupancy': {
        // Get daily occupancy rates - get current total units and occupied units per day
        const occupancyData = await prisma.$queryRaw<any[]>`
          SELECT 
            date.date::date as date,
            COUNT(*) FILTER (WHERE u.status = 'occupied')::numeric as occupied,
            COUNT(*)::numeric as total
          FROM generate_series(${startDate}::date, CURRENT_DATE, '1 day'::interval) as date
          LEFT JOIN units u ON u.updated_at <= date.date::date + INTERVAL '1 day'
            AND (u.created_at <= date.date::date + INTERVAL '1 day' OR u.status = 'occupied')
          GROUP BY date.date::date
          ORDER BY date.date::date
        `;

        const occupancyMap = new Map<string, number>();
        occupancyData.forEach((row: any) => {
          const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : null;
          if (dateStr) {
            const total = Number(row.total || 0);
            const occupied = Number(row.occupied || 0);
            if (total > 0) {
              occupancyMap.set(dateStr, (occupied / total) * 100);
            } else {
              occupancyMap.set(dateStr, 0);
            }
          }
        });

        labels.forEach(label => {
          data.push(occupancyMap.get(label) || 0);
        });
        break;
      }
      case 'tenants': {
        // Get daily tenant counts
        const tenantData = await prisma.$queryRaw<any[]>`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::numeric as count
          FROM users
          WHERE role = 'tenant'
            AND created_at >= ${startDate}::timestamp
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)
        `;

        const tenantMap = new Map();
        let cumulative = 0;
        tenantData.forEach((row: any) => {
          const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : null;
          if (dateStr) {
            cumulative += Number(row.count || 0);
            tenantMap.set(dateStr, cumulative);
          }
        });

        // Get total tenants before start date
        const initialCount = await prisma.user.count({
          where: {
            role: 'tenant',
            created_at: { lt: startDate }
          }
        });

        labels.forEach(label => {
          const count = tenantMap.get(label);
          data.push(count !== undefined ? initialCount + count : initialCount);
        });
        break;
      }
      default:
        labels.forEach(() => data.push(0));
    }

    const chartData = { labels, data };

    writeSuccess(res, 200, `${chartType} chart data retrieved successfully`, chartData);
  } catch (err: any) {
    console.error('Error fetching analytics chart:', err);
    writeError(res, 500, 'Failed to fetch analytics chart', err.message);
  }
};

// System Settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const { SystemSettingsService } = await import('../services/system-settings.service.js');
    const service = new SystemSettingsService();
    const user = (req as any).user;
    
    const category = req.query.category as string | undefined;
    let settings = await service.getSystemSettings(category);

    // If no settings exist, initialize default settings
    if (settings.length === 0 && !category) {
      console.log('No system settings found. Initializing default settings...');
      await service.initializeDefaultSettings(user);
      settings = await service.getSystemSettings();
    }

    writeSuccess(res, 200, 'System settings retrieved successfully', settings);
  } catch (err: any) {
    console.error('Error fetching system settings:', err);
    writeError(res, 500, 'Failed to fetch system settings', err.message);
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { SystemSettingsService } = await import('../services/system-settings.service.js');
    const service = new SystemSettingsService();
    const user = (req as any).user;
    
    const { key } = req.params;
    const { value } = req.body;

    if (!key) {
      return writeError(res, 400, 'Setting key is required');
    }

    if (value === undefined) {
      return writeError(res, 400, 'Setting value is required');
    }

    const updatedSetting = await service.updateSystemSetting(user, key, String(value));

    writeSuccess(res, 200, 'System setting updated successfully', updatedSetting);
  } catch (err: any) {
    console.error('Error updating system setting:', err);
    writeError(res, 500, 'Failed to update system setting', err.message);
  }
};

export const bulkUpdateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { SystemSettingsService } = await import('../services/system-settings.service.js');
    const service = new SystemSettingsService();
    const user = (req as any).user;
    
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return writeError(res, 400, 'Settings object is required');
    }

    const updatedSettings = await service.bulkUpdateSystemSettings(user, settings);

    writeSuccess(res, 200, 'System settings updated successfully', updatedSettings);
  } catch (err: any) {
    console.error('Error bulk updating system settings:', err);
    writeError(res, 500, 'Failed to update system settings', err.message);
  }
};

export const initializeSystemSettings = async (req: Request, res: Response) => {
  try {
    const { SystemSettingsService } = await import('../services/system-settings.service.js');
    const service = new SystemSettingsService();
    const user = (req as any).user;
    
    await service.initializeDefaultSettings(user);
    const settings = await service.getSystemSettings();

    writeSuccess(res, 200, 'System settings initialized successfully', settings);
  } catch (err: any) {
    console.error('Error initializing system settings:', err);
    writeError(res, 500, 'Failed to initialize system settings', err.message);
  }
};

// Security Logs
export const getSecurityLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

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
  } catch (err: any) {
    console.error('Error fetching security logs:', err);
    writeError(res, 500, 'Failed to fetch security logs', err.message);
  }
};

// User Management
export const getUserManagement = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const role = req.query.role as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};

    // Apply role filter
    if (role && role !== 'all') {
      where.role = role;
    }

    // Apply search filter
    if (search) {
      // UUID regex pattern
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      const searchConditions: any[] = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } },
      ];

      // Only add ID search if search term looks like a valid UUID
      if (uuidRegex.test(search)) {
        searchConditions.push({ id: { equals: search } });
      }

      // If role filter is also applied, combine with AND
      if (role && role !== 'all') {
        where.AND = [
          { role: role },
          { OR: searchConditions }
        ];
        // Remove role from top level since it's now in AND
        delete where.role;
      } else {
        where.OR = searchConditions;
      }
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          status: true,
          email_verified: true,
          company_id: true,
          agency_id: true,
          landlord_id: true,
          created_at: true,
          updated_at: true,
          last_login_at: true,
          company: {
            select: {
              id: true,
              name: true,
            }
          },
          agency: {
            select: {
              id: true,
              name: true,
            }
          },
          owned_properties: {
            select: {
              id: true,
              name: true,
            },
            take: 1,
          },
          tenant_profile: {
            select: {
              profile_picture: true,
            },
          },
          preferences: {
            select: {
              signature: true, // Profile picture stored here as workaround
            },
          },
        },
        orderBy: {
          created_at: 'desc'
        },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    const userData = {
      users: users,
      total: total,
      page: page,
      limit: limit,
      pages: Math.ceil(total / limit)
    };

    writeSuccess(res, 200, 'Users retrieved successfully', userData);
  } catch (err: any) {
    console.error('Error fetching users:', err);
    writeError(res, 500, 'Failed to fetch users', err.message);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, role, company_id, phone_number, send_invitation } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return writeError(res, 400, 'User with this email already exists');
    }

    // For invitation flow, create user without password
    // For direct creation, require password
    let hashedPassword = null;
    
    if (send_invitation || !password) {
      // Invitation flow - user will set password during registration
      // Don't set status here - let it be handled by the invitation process
    } else {
      // Direct creation - hash the provided password
      hashedPassword = await bcrypt.hash(password, 12);
    }

    // Get or create a default company for team members if not provided
    let finalCompanyId = company_id;
    if (!finalCompanyId) {
      // Find or create a default system company for team members
      const defaultCompany = await prisma.company.findFirst({
        where: { name: 'LetRents System' }
      });
      
      if (defaultCompany) {
        finalCompanyId = defaultCompany.id;
      } else {
        const newCompany = await prisma.company.create({
          data: {
            name: 'LetRents System',
            email: 'system@letrents.com',
            country: 'Kenya',
            status: 'active',
            subscription_plan: 'enterprise',
          }
        });
        finalCompanyId = newCompany.id;
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        phone_number: phone_number || undefined,
        role: role as any,
        company_id: finalCompanyId,
        // Don't set status here - let it be handled by the invitation process or database default
        email_verified: false,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        company_id: true,
        created_at: true,
      }
    });

    // If send_invitation is true, send invitation email
    if (send_invitation) {
      try {
        // Create a proper request object for sendInvitation
        const inviteReq = {
          ...req,
          params: { entityType: 'user', entityId: newUser.id },
          query: {}
        } as any;
        
        // Create a response wrapper that won't interfere with the main response
        let invitationSent = false;
        let invitationError: any = null;
        
        const inviteRes = {
          status: (code: number) => inviteRes,
          json: (data: any) => {
            invitationSent = true;
            return inviteRes;
          }
        } as any;
        
        // Call sendInvitation - don't wait for it to complete
        sendInvitation(inviteReq, inviteRes).catch(err => {
          console.error('Error sending invitation email:', err);
          invitationError = err;
        });
      } catch (inviteError) {
        console.error('Error sending invitation:', inviteError);
        // Don't fail the user creation if invitation fails
      }
    }

    writeSuccess(res, 201, send_invitation ? 'User created and invitation will be sent' : 'User created successfully', newUser);
  } catch (err: any) {
    console.error('Error creating user:', err);
    writeError(res, 500, 'Failed to create user', err.message);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        email_verified: true,
        company_id: true,
        agency_id: true,
        landlord_id: true,
        created_at: true,
        updated_at: true,
        last_login_at: true,
        id_number: true,
        address: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            address: true,
            status: true,
            properties: {
              select: {
                street: true,
                city: true,
                region: true,
                country: true,
                postal_code: true,
              },
              take: 1,
              orderBy: {
                created_at: 'asc'
              }
            }
          }
        },
        agency: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
            address: true,
            status: true
          }
        },
        landlord: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            address: true,
            status: true
          }
        },
        tenant_profile: {
          select: {
            profile_picture: true,
          }
        },
        preferences: {
          select: {
            signature: true, // Profile picture stored here as workaround
          }
        }
      }
    });

    if (!user) {
      return writeError(res, 404, 'User not found');
    }

    // Process company data: if company address is null, use first property's address
    let processedCompany: any = user.company;
    if (processedCompany && !processedCompany.address && processedCompany.properties && processedCompany.properties.length > 0) {
      const firstProperty = processedCompany.properties[0];
      // Build address from property fields
      const propertyAddressParts = [
        firstProperty.street,
        firstProperty.city,
        firstProperty.region,
        firstProperty.postal_code,
        firstProperty.country
      ].filter(Boolean);
      
      if (propertyAddressParts.length > 0) {
        processedCompany = {
          ...processedCompany,
          address: propertyAddressParts.join(', ')
        };
      }
    }
    
    // Remove properties array from company (we only needed it for address fallback)
    if (processedCompany && processedCompany.properties) {
      const { properties, ...companyWithoutProperties } = processedCompany;
      processedCompany = companyWithoutProperties;
    }

    // Ensure tenant_profile and preferences are always included (even if null)
    // This prevents them from being undefined in the response
    const userResponse = {
      ...user,
      company: processedCompany,
      tenant_profile: user.tenant_profile || null,
      preferences: user.preferences || null,
    };

    writeSuccess(res, 200, 'User retrieved successfully', userResponse);
  } catch (err: any) {
    console.error('Error fetching user:', err);
    writeError(res, 500, 'Failed to fetch user', err.message);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role, status } = req.body;

    const updatedUser = await prisma.$queryRaw`
      UPDATE users 
      SET first_name = ${first_name}, last_name = ${last_name}, role = ${role}, status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, email, first_name, last_name, role, status, updated_at
    `;

    writeSuccess(res, 200, 'User updated successfully', updatedUser);
  } catch (err: any) {
    console.error('Error updating user:', err);
    writeError(res, 500, 'Failed to update user', err.message);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$queryRaw`DELETE FROM users WHERE id = ${id}::uuid`;

    writeSuccess(res, 200, 'User deleted successfully', { id });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    writeError(res, 500, 'Failed to delete user', err.message);
  }
};

// Company Management
export const getCompanyManagement = async (req: Request, res: Response) => {
  try {
    const companies = await prisma.$queryRaw`
      SELECT 
        id, name, business_type, email, phone_number, 
        status, subscription_plan, created_at, updated_at
      FROM companies 
      ORDER BY created_at DESC
    `;

    writeSuccess(res, 200, 'Companies retrieved successfully', companies);
  } catch (err: any) {
    console.error('Error fetching companies:', err);
    writeError(res, 500, 'Failed to fetch companies', err.message);
  }
};

export const createCompany = async (req: Request, res: Response) => {
  try {
    const { name, business_type, email, phone_number, subscription_plan } = req.body;

    const newCompany = await prisma.$queryRaw`
      INSERT INTO companies (name, business_type, email, phone_number, subscription_plan, status)
      VALUES (${name}, ${business_type}, ${email}, ${phone_number}, ${subscription_plan}, 'pending')
      RETURNING id, name, business_type, email, phone_number, subscription_plan, status, created_at
    `;

    writeSuccess(res, 201, 'Company created successfully', newCompany);
  } catch (err: any) {
    console.error('Error creating company:', err);
    writeError(res, 500, 'Failed to create company', err.message);
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JWTClaims;
    const { name, business_type, email, phone_number, address, street, city, region, country, postal_code, subscription_plan, status } = req.body;

    // Check if user is updating their own company (for landlords/agency_admins)
    if (user.role !== 'super_admin') {
      // Non-super-admin users can only update their own company
      if (!user.company_id || user.company_id !== id) {
        return writeError(res, 403, 'You can only update your own company');
      }
      
      // Restrict which fields non-super-admins can update
      // They cannot update: business_type, subscription_plan, status
      if (business_type !== undefined || subscription_plan !== undefined || status !== undefined) {
        return writeError(res, 403, 'You do not have permission to update business_type, subscription_plan, or status');
      }
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (business_type !== undefined && user.role === 'super_admin') updateData.business_type = business_type;
    if (email !== undefined) updateData.email = email;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (street !== undefined) updateData.street = street;
    if (city !== undefined) updateData.city = city;
    if (region !== undefined) updateData.region = region;
    if (country !== undefined) updateData.country = country;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (subscription_plan !== undefined && user.role === 'super_admin') updateData.subscription_plan = subscription_plan;
    if (status !== undefined && user.role === 'super_admin') updateData.status = status;
    updateData.updated_at = new Date();

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        business_type: true,
        email: true,
        phone_number: true,
        address: true,
        street: true,
        city: true,
        region: true,
        country: true,
        postal_code: true,
        subscription_plan: true,
        status: true,
        updated_at: true,
      },
    });

    writeSuccess(res, 200, 'Company updated successfully', updatedCompany);
  } catch (err: any) {
    console.error('Error updating company:', err);
    writeError(res, 500, 'Failed to update company', err.message);
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$queryRaw`DELETE FROM companies WHERE id = ${id}::uuid`;

    writeSuccess(res, 200, 'Company deleted successfully', { id });
  } catch (err: any) {
    console.error('Error deleting company:', err);
    writeError(res, 500, 'Failed to delete company', err.message);
  }
};

// Agency Management
export const getAgencyManagement = async (req: Request, res: Response) => {
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
  } catch (err: any) {
    console.error('Error fetching agencies:', err);
    writeError(res, 500, 'Failed to fetch agencies', err.message);
  }
};

export const createAgency = async (req: Request, res: Response) => {
  try {
    const { name, email, phone_number, address, company_id, created_by } = req.body;

    const newAgency = await prisma.$queryRaw`
      INSERT INTO agencies (name, email, phone_number, address, company_id, created_by, status)
      VALUES (${name}, ${email}, ${phone_number}, ${address}, ${company_id}::uuid, ${created_by}::uuid, 'pending')
      RETURNING id, name, email, phone_number, address, status, created_at
    `;

    writeSuccess(res, 201, 'Agency created successfully', newAgency);
  } catch (err: any) {
    console.error('Error creating agency:', err);
    writeError(res, 500, 'Failed to create agency', err.message);
  }
};

export const getAgencyById = async (req: Request, res: Response) => {
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
      agency.company_id ? prisma.user.count({ 
        where: { 
          role: 'agent',
          OR: [
            { agency_id: id },
            { company_id: agency.company_id }
          ]
        } 
      }) : prisma.user.count({ 
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
  } catch (err: any) {
    console.error('Error fetching agency:', err);
    writeError(res, 500, 'Failed to fetch agency', err.message);
  }
};

export const updateAgency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone_number, address, status } = req.body;

    const updatedAgency = await prisma.$queryRaw`
      UPDATE agencies 
      SET name = ${name}, email = ${email}, phone_number = ${phone_number}, 
          address = ${address}, status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, name, email, phone_number, address, status, updated_at
    `;

    writeSuccess(res, 200, 'Agency updated successfully', updatedAgency);
  } catch (err: any) {
    console.error('Error updating agency:', err);
    writeError(res, 500, 'Failed to update agency', err.message);
  }
};

export const deleteAgency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$queryRaw`DELETE FROM agencies WHERE id = ${id}::uuid`;

    writeSuccess(res, 200, 'Agency deleted successfully', { id });
  } catch (err: any) {
    console.error('Error deleting agency:', err);
    writeError(res, 500, 'Failed to delete agency', err.message);
  }
};

// Get properties for an agency
export const getAgencyProperties = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

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
  } catch (err: any) {
    console.error('Error fetching agency properties:', err);
    writeError(res, 500, 'Failed to fetch agency properties', err.message);
  }
};

// Get units for an agency
export const getAgencyUnits = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

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
  } catch (err: any) {
    console.error('Error fetching agency units:', err);
    writeError(res, 500, 'Failed to fetch agency units', err.message);
  }
};

// Additional endpoints for frontend compatibility
export const getPlatformAnalytics = async (req: Request, res: Response) => {
  try {
    const [
      totalAgencies,
      totalProperties,
      unitsResult,
      rentRevenue,
      subscriptionRevenue,
      activeTenantsResult,
      independentLandlordsResult,
      agentsResult,
      averageRentResult
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM agencies`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM properties`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count, status FROM units GROUP BY status`,
      prisma.$queryRaw`SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM billing_invoices WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'tenant'::user_role AND status = 'active'::user_status`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'landlord'::user_role`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM users WHERE role = 'agent'::user_role`,
      prisma.$queryRaw`SELECT COALESCE(AVG(rent_amount), 0)::numeric as avg_rent FROM units WHERE rent_amount IS NOT NULL AND rent_amount > 0`
    ]);

    const agencies = Array.isArray(totalAgencies) ? Number((totalAgencies[0] as any)?.count || 0) : 0;
    const properties = Array.isArray(totalProperties) ? Number((totalProperties[0] as any)?.count || 0) : 0;
    
    // Calculate units data
    const unitsData = Array.isArray(unitsResult) ? unitsResult as any[] : [];
    const totalUnits = unitsData.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const activeUnits = Number(unitsData.find(item => item.status === 'occupied')?.count || 0);
    const vacantUnits = Number(unitsData.find(item => item.status === 'vacant')?.count || 0);
    
    const rentRev = Array.isArray(rentRevenue) ? Number((rentRevenue[0] as any)?.total || 0) : 0;
    const subRev = Array.isArray(subscriptionRevenue) ? Number((subscriptionRevenue[0] as any)?.total || 0) : 0;
    const monthlyRevenue = rentRev + subRev;
    const activeTenants = Array.isArray(activeTenantsResult) ? Number((activeTenantsResult[0] as any)?.count || 0) : 0;
    const totalLandlords = Array.isArray(independentLandlordsResult) ? Number((independentLandlordsResult[0] as any)?.count || 0) : 0;
    const agents = Array.isArray(agentsResult) ? Number((agentsResult[0] as any)?.count || 0) : 0;
    const averageRent = Array.isArray(averageRentResult) ? Number((averageRentResult[0] as any)?.avg_rent || 0) : 0;

    // Calculate real occupancy rate
    const occupancyRate = totalUnits > 0 ? Math.round((activeUnits / totalUnits) * 100 * 100) / 100 : 0;

    // Get system performance metrics
    const uptimeSeconds = process.uptime();
    const uptimeDays = uptimeSeconds / (24 * 60 * 60);
    const uptimePercentage = Math.min(100, Math.round((uptimeDays / 30) * 100 * 100) / 100);

    // Get active users (users with status = 'active')
    const activeUsersResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE status = 'active'::user_status
    `;
    const activeUsers = Array.isArray(activeUsersResult) ? Number((activeUsersResult[0] as any)?.count || 0) : activeTenants;

    // Estimate API calls from recent activities
    const apiCallsResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM users 
      WHERE updated_at >= NOW() - INTERVAL '7 days'
    `;
    const recentActivities = Array.isArray(apiCallsResult) ? Number((apiCallsResult[0] as any)?.count || 0) : 0;
    const estimatedApiCalls = recentActivities * 50; // Rough estimate of API calls
    
    const platformData = {
      total_agencies: agencies,
      total_properties: properties,
      total_units: totalUnits,
      active_units: activeUnits,
      vacant_units: vacantUnits,
      active_tenants: activeTenants,
      independent_landlords: totalLandlords, // Keep for backward compatibility
      total_landlords: totalLandlords, // New field name
      agents: agents,
      monthly_revenue: monthlyRevenue,
      ytd_revenue: monthlyRevenue * 12, // Year-to-date estimate
      occupancy_rate: occupancyRate,
      average_rent: averageRent,
      system_performance: {
        uptime_percentage: uptimePercentage,
        active_users: activeUsers,
        api_calls: estimatedApiCalls,
        error_rate: 0.1 // Would need error tracking to calculate accurately
      }
    };

    writeSuccess(res, 200, 'Platform analytics retrieved successfully', platformData);
  } catch (err: any) {
    console.error('Error fetching platform analytics:', err);
    writeError(res, 500, 'Failed to fetch platform analytics', err.message);
  }
};

export const getRevenueDashboard = async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || '30d';
    
    const [
      rentRevenue,
      subscriptionRevenue,
      monthlyRentRevenue,
      monthlySubscriptionRevenue,
      revenueByProperty
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied'`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM billing_invoices WHERE status = 'paid'`,
      prisma.$queryRaw`SELECT COALESCE(SUM(rent_amount), 0)::numeric as monthly FROM units WHERE status = 'occupied'`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric as monthly FROM billing_invoices WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'`,
      prisma.$queryRaw`
        SELECT p.name, COALESCE(SUM(u.rent_amount), 0)::numeric as revenue
        FROM properties p
        LEFT JOIN units u ON p.id = u.property_id AND u.status = 'occupied'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 10
      `
    ]);

    const rentRev = Array.isArray(rentRevenue) ? Number((rentRevenue[0] as any)?.total || 0) : 0;
    const subRev = Array.isArray(subscriptionRevenue) ? Number((subscriptionRevenue[0] as any)?.total || 0) : 0;
    const total = rentRev + subRev;
    
    const monthlyRent = Array.isArray(monthlyRentRevenue) ? Number((monthlyRentRevenue[0] as any)?.monthly || 0) : 0;
    const monthlySub = Array.isArray(monthlySubscriptionRevenue) ? Number((monthlySubscriptionRevenue[0] as any)?.monthly || 0) : 0;
    const monthly = monthlyRent + monthlySub;

    const revenueData = {
      total_revenue: total,
      monthly_revenue: monthly,
      ytd_revenue: monthly * 12,
      revenue_by_property: revenueByProperty,
      growth_rate: 8.5,
      period: period
    };

    writeSuccess(res, 200, 'Revenue dashboard retrieved successfully', revenueData);
  } catch (err: any) {
    console.error('Error fetching revenue dashboard:', err);
    writeError(res, 500, 'Failed to fetch revenue dashboard', err.message);
  }
};

export const getAgencyPerformance = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const agencyPerformance = await prisma.$queryRaw`
      SELECT 
        a.id, 
        a.name as agency_name, 
        a.email,
        COUNT(DISTINCT p.id)::int as total_properties,
        COUNT(DISTINCT u.id)::int as total_units,
        SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END)::int as occupied_units,
        COALESCE(SUM(CASE WHEN u.status = 'occupied' THEN u.rent_amount ELSE 0 END), 0)::numeric as revenue
      FROM agencies a
      LEFT JOIN properties p ON a.id = p.agency_id
      LEFT JOIN units u ON p.id = u.property_id
      GROUP BY a.id, a.name, a.email
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

    // Transform the data to ensure proper field names
    const agencies = Array.isArray(agencyPerformance) 
      ? agencyPerformance.map((agency: any) => ({
          id: agency.id,
          agency_name: agency.agency_name || agency.name || 'Unknown',
          email: agency.email,
          total_properties: Number(agency.total_properties || 0),
          total_units: Number(agency.total_units || 0),
          occupied_units: Number(agency.occupied_units || 0),
          revenue: Number(agency.revenue || 0)
        }))
      : [];

    writeSuccess(res, 200, 'Agency performance retrieved successfully', agencies);
  } catch (err: any) {
    console.error('Error fetching agency performance:', err);
    writeError(res, 500, 'Failed to fetch agency performance', err.message);
  }
};

// Additional missing endpoints
export const getUserMetrics = async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string;
    
    // Build where clause
    const where: any = {};
    if (role && role !== 'all') {
      where.role = role;
    }

    // Get total users count
    const totalUsers = await prisma.user.count({ where });

    // Get active users count
    const activeUsers = await prisma.user.count({
      where: {
        ...where,
        status: 'active'
      }
    });

    // Get inactive users count
    const inactiveUsers = await prisma.user.count({
      where: {
        ...where,
        status: 'inactive'
      }
    });

    // Get suspended users count
    const suspendedUsers = await prisma.user.count({
      where: {
        ...where,
        status: 'suspended'
      }
    });

    // Get pending users count
    const pendingUsers = await prisma.user.count({
      where: {
        ...where,
        status: 'pending'
      }
    });

    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      where,
      _count: {
        role: true
      }
    });

    // Get new users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await prisma.user.count({
      where: {
        ...where,
        created_at: {
          gte: today
        }
      }
    });

    // Calculate growth rate (users created in last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const usersLast30Days = await prisma.user.count({
      where: {
        ...where,
        created_at: {
          gte: thirtyDaysAgo
        }
      }
    });

    const usersPrevious30Days = await prisma.user.count({
      where: {
        ...where,
        created_at: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        }
      }
    });

    const growthRate = usersPrevious30Days > 0
      ? ((usersLast30Days - usersPrevious30Days) / usersPrevious30Days) * 100
      : usersLast30Days > 0 ? 100 : 0;

    // Get total agencies count (if applicable)
    const agencies = await prisma.agency.count().catch(() => 0);

    const metrics = {
      total_users: totalUsers,
      active_users: activeUsers,
      inactive_users: inactiveUsers,
      suspended_users: suspendedUsers,
      pending_users: pendingUsers,
      new_today: newToday,
      agencies: agencies,
      users_by_role: usersByRole.map(item => ({
        role: item.role,
        count: item._count.role
      })),
      growth_rate: Math.round(growthRate * 100) / 100
    };

    writeSuccess(res, 200, 'User metrics retrieved successfully', metrics);
  } catch (err: any) {
    console.error('Error fetching user metrics:', err);
    writeError(res, 500, 'Failed to fetch user metrics', err.message);
  }
};

export const getRevenueSummary = async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || 'month';
    
    // Calculate date ranges based on period
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;
    
    if (period === 'week') {
      // Current week (Monday to Sunday)
      const currentDay = now.getDay();
      const diff = currentDay === 0 ? -6 : 1 - currentDay;
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() + diff);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);
      
      // Previous week
      previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 7);
      previousEnd = new Date(currentEnd);
      previousEnd.setDate(currentEnd.getDate() - 7);
    } else if (period === 'month') {
      // Current month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Previous month
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'quarter') {
      // Current quarter
      const currentQuarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      currentEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
      
      // Previous quarter
      const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const prevYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      previousStart = new Date(prevYear, prevQuarter * 3, 1);
      previousEnd = new Date(prevYear, (prevQuarter + 1) * 3, 0, 23, 59, 59, 999);
    } else {
      // Year
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }

    // Get current period revenue (subscription + rental)
    const [currentSubRevenue, currentRentRevenue, currentAgencies] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM billing_invoices WHERE status = 'paid' AND paid_at >= ${currentStart}::timestamp AND paid_at <= ${currentEnd}::timestamp`,
      prisma.$queryRaw<any[]>`SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied' AND updated_at >= ${currentStart}::timestamp AND updated_at <= ${currentEnd}::timestamp`,
      prisma.$queryRaw<any[]>`SELECT COUNT(DISTINCT a.id)::numeric as count FROM agencies a WHERE a.created_at <= ${currentEnd}::timestamp`
    ]);

    // Get previous period revenue
    const [previousSubRevenue, previousRentRevenue, previousAgencies] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM billing_invoices WHERE status = 'paid' AND paid_at >= ${previousStart}::timestamp AND paid_at <= ${previousEnd}::timestamp`,
      prisma.$queryRaw<any[]>`SELECT COALESCE(SUM(rent_amount), 0)::numeric as total FROM units WHERE status = 'occupied' AND updated_at >= ${previousStart}::timestamp AND updated_at <= ${previousEnd}::timestamp`,
      prisma.$queryRaw<any[]>`SELECT COUNT(DISTINCT a.id)::numeric as count FROM agencies a WHERE a.created_at <= ${previousEnd}::timestamp`
    ]);

    const currentSub = Array.isArray(currentSubRevenue) ? Number((currentSubRevenue[0] as any)?.total || 0) : 0;
    const currentRent = Array.isArray(currentRentRevenue) ? Number((currentRentRevenue[0] as any)?.total || 0) : 0;
    const currentTotal = currentSub + currentRent;
    const currentAgenciesCount = Array.isArray(currentAgencies) ? Number((currentAgencies[0] as any)?.count || 0) : 0;

    const previousSub = Array.isArray(previousSubRevenue) ? Number((previousSubRevenue[0] as any)?.total || 0) : 0;
    const previousRent = Array.isArray(previousRentRevenue) ? Number((previousRentRevenue[0] as any)?.total || 0) : 0;
    const previousTotal = previousSub + previousRent;
    const previousAgenciesCount = Array.isArray(previousAgencies) ? Number((previousAgencies[0] as any)?.count || 0) : 0;

    const revenueGrowth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
    const agenciesGrowth = previousAgenciesCount > 0 ? ((currentAgenciesCount - previousAgenciesCount) / previousAgenciesCount * 100) : 0;
    const avgRevenuePerAgencyCurrent = currentAgenciesCount > 0 ? currentTotal / currentAgenciesCount : 0;
    const avgRevenuePerAgencyPrevious = previousAgenciesCount > 0 ? previousTotal / previousAgenciesCount : 0;
    const avgRevenueGrowth = avgRevenuePerAgencyPrevious > 0 ? ((avgRevenuePerAgencyCurrent - avgRevenuePerAgencyPrevious) / avgRevenuePerAgencyPrevious * 100) : 0;

    const summary = {
      current_period: {
        total_revenue: currentTotal,
        active_agencies: currentAgenciesCount,
        average_revenue_per_agency: avgRevenuePerAgencyCurrent
      },
      previous_period: {
        total_revenue: previousTotal,
        active_agencies: previousAgenciesCount,
        average_revenue_per_agency: avgRevenuePerAgencyPrevious
      },
      growth: {
        revenue: revenueGrowth,
        agencies: agenciesGrowth,
        avg_revenue_per_agency: avgRevenueGrowth
      },
      period: period
    };

    writeSuccess(res, 200, 'Revenue summary retrieved successfully', summary);
  } catch (err: any) {
    console.error('Error fetching revenue summary:', err);
    writeError(res, 500, 'Failed to fetch revenue summary', err.message);
  }
};

export const getBillingPlans = async (req: Request, res: Response) => {
  try {
    // Get real subscriber counts and revenue for each plan
    const planStats = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
      where: {
        status: { in: ['active', 'trial'] }
      }
    });

    // Get monthly revenue for each plan from paid invoices
    const planRevenue = await prisma.$queryRaw<any[]>`
      SELECT 
        s.plan,
        COALESCE(SUM(bi.amount), 0)::numeric as monthly_revenue
      FROM subscriptions s
      LEFT JOIN billing_invoices bi ON bi.subscription_id = s.id 
        AND bi.status = 'paid'
        AND bi.paid_at >= DATE_TRUNC('month', CURRENT_DATE)
      WHERE s.status IN ('active', 'trial')
      GROUP BY s.plan
    `;

    // Create a map of plan stats
    const statsMap = new Map();
    planStats.forEach(stat => {
      statsMap.set(stat.plan, { subscribers: stat._count.plan, revenue: 0 });
    });

    planRevenue.forEach((row: any) => {
      const plan = row.plan;
      if (statsMap.has(plan)) {
        statsMap.get(plan).revenue = Number(row.monthly_revenue || 0);
      } else {
        statsMap.set(plan, { subscribers: 0, revenue: Number(row.monthly_revenue || 0) });
      }
    });

    // Base plan configurations
    const planConfigs = [
      {
        id: '1',
        name: 'Starter',
        plan_key: 'starter',
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
        max_properties: 5,
        max_units: 50
      },
      {
        id: '2',
        name: 'Professional',
        plan_key: 'professional',
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
        max_properties: 20,
        max_units: 200
      },
      {
        id: '3',
        name: 'Enterprise',
        plan_key: 'enterprise',
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
        max_properties: null, // Unlimited
        max_units: null // Unlimited
      }
    ];

    // Merge real stats with plan configs
    const plans = planConfigs.map(plan => {
      const stats = statsMap.get(plan.plan_key) || { subscribers: 0, revenue: 0 };
      return {
        ...plan,
        subscribers: stats.subscribers,
        revenue: stats.revenue
      };
    });

    writeSuccess(res, 200, 'Billing plans retrieved successfully', plans);
  } catch (err: any) {
    console.error('Error fetching billing plans:', err);
    writeError(res, 500, 'Failed to fetch billing plans', err.message);
  }
};

export const getApplications = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    // Build where clause
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch applications from database
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          reviewer: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.application.count({ where })
    ]);

    // Transform to match frontend expectations
    const transformedApplications = applications.map((app: any) => ({
      id: app.id,
      agency_name: app.company_name || app.contact_person, // For backward compatibility
      company_name: app.company_name,
      contact_email: app.contact_email,
      contact_phone: app.contact_phone,
      contact_person: app.contact_person,
      contact_position: app.contact_position,
      business_type: app.business_type,
      license_number: app.license_number,
      location: app.location,
      address: app.address,
      city: app.city,
      country: app.country,
      tax_id: app.tax_id,
      website: app.website,
      description: app.description,
      documents: Array.isArray(app.documents) ? app.documents : [],
      years_in_business: app.years_in_business,
      properties_managed: app.properties_managed,
      employees_count: app.employees_count,
      annual_revenue: app.annual_revenue,
      status: app.status,
      priority: app.priority || 'medium',
      review_notes: app.review_notes,
      reviewed_by: app.reviewer ? `${app.reviewer.first_name} ${app.reviewer.last_name}` : null,
      reviewed_at: app.reviewed_at?.toISOString() || null,
      submitted_at: app.created_at.toISOString(),
      approved_at: app.approved_at?.toISOString() || null,
      created_at: app.created_at.toISOString(),
      updated_at: app.updated_at.toISOString()
    }));

    const result = {
      applications: transformedApplications,
      total,
      limit,
      offset
    };

    writeSuccess(res, 200, 'Applications retrieved successfully', result);
  } catch (err: any) {
    console.error('Error fetching applications:', err);
    writeError(res, 500, 'Failed to fetch applications', err.message);
  }
};

export const getApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    if (!application) {
      return writeError(res, 404, 'Application not found');
    }

    // Transform to match frontend expectations
    const transformedApplication = {
      id: application.id,
      agency_name: application.company_name || application.contact_person,
      company_name: application.company_name,
      contact_email: application.contact_email,
      contact_phone: application.contact_phone,
      contact_person: application.contact_person,
      contact_position: application.contact_position,
      business_type: application.business_type,
      license_number: application.license_number,
      location: application.location,
      address: application.address,
      city: application.city,
      country: application.country,
      tax_id: application.tax_id,
      website: application.website,
      description: application.description,
      documents: Array.isArray(application.documents) ? application.documents : [],
      years_in_business: application.years_in_business,
      properties_managed: application.properties_managed,
      employees_count: application.employees_count,
      annual_revenue: application.annual_revenue,
      status: application.status,
      priority: application.priority || 'medium',
      review_notes: application.review_notes,
      reviewed_by: application.reviewer ? `${application.reviewer.first_name} ${application.reviewer.last_name}` : null,
      reviewed_at: application.reviewed_at?.toISOString() || null,
      submitted_at: application.created_at.toISOString(),
      approved_at: application.approved_at?.toISOString() || null,
      created_at: application.created_at.toISOString(),
      updated_at: application.updated_at.toISOString()
    };

    writeSuccess(res, 200, 'Application retrieved successfully', transformedApplication);
  } catch (err: any) {
    console.error('Error fetching application:', err);
    writeError(res, 500, 'Failed to fetch application', err.message);
  }
};

export const approveApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user = (req as any).user;

    const application = await prisma.application.findUnique({
      where: { id }
    });

    if (!application) {
      return writeError(res, 404, 'Application not found');
    }

    if (application.status === 'approved') {
      return writeError(res, 400, 'Application is already approved');
    }

    // Update application in database
    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: user?.user_id || null,
        review_notes: notes || null,
        approved_at: new Date(),
        updated_at: new Date()
      },
      include: {
        reviewer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    // Transform response
    const transformedApplication = {
      id: updatedApplication.id,
      agency_name: updatedApplication.company_name || updatedApplication.contact_person,
      company_name: updatedApplication.company_name,
      contact_email: updatedApplication.contact_email,
      contact_phone: updatedApplication.contact_phone,
      contact_person: updatedApplication.contact_person,
      contact_position: updatedApplication.contact_position,
      business_type: updatedApplication.business_type,
      license_number: updatedApplication.license_number,
      location: updatedApplication.location,
      address: updatedApplication.address,
      city: updatedApplication.city,
      country: updatedApplication.country,
      tax_id: updatedApplication.tax_id,
      website: updatedApplication.website,
      description: updatedApplication.description,
      documents: Array.isArray(updatedApplication.documents) ? updatedApplication.documents : [],
      years_in_business: updatedApplication.years_in_business,
      properties_managed: updatedApplication.properties_managed,
      employees_count: updatedApplication.employees_count,
      annual_revenue: updatedApplication.annual_revenue,
      status: updatedApplication.status,
      priority: updatedApplication.priority || 'medium',
      review_notes: updatedApplication.review_notes,
      reviewed_by: updatedApplication.reviewer ? `${updatedApplication.reviewer.first_name} ${updatedApplication.reviewer.last_name}` : null,
      reviewed_at: updatedApplication.reviewed_at?.toISOString() || null,
      submitted_at: updatedApplication.created_at.toISOString(),
      approved_at: updatedApplication.approved_at?.toISOString() || null,
      created_at: updatedApplication.created_at.toISOString(),
      updated_at: updatedApplication.updated_at.toISOString()
    };

    writeSuccess(res, 200, 'Application approved successfully', transformedApplication);
  } catch (err: any) {
    console.error('Error approving application:', err);
    writeError(res, 500, 'Failed to approve application', err.message);
  }
};

export const rejectApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user = (req as any).user;

    if (!notes) {
      return writeError(res, 400, 'Rejection reason is required');
    }

    const application = await prisma.application.findUnique({
      where: { id }
    });

    if (!application) {
      return writeError(res, 404, 'Application not found');
    }

    if (application.status === 'rejected') {
      return writeError(res, 400, 'Application is already rejected');
    }

    // Update application in database
    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_at: new Date(),
        reviewed_by: user?.user_id || null,
        review_notes: notes,
        updated_at: new Date()
      },
      include: {
        reviewer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    // Transform response
    const transformedApplication = {
      id: updatedApplication.id,
      agency_name: updatedApplication.company_name || updatedApplication.contact_person,
      company_name: updatedApplication.company_name,
      contact_email: updatedApplication.contact_email,
      contact_phone: updatedApplication.contact_phone,
      contact_person: updatedApplication.contact_person,
      contact_position: updatedApplication.contact_position,
      business_type: updatedApplication.business_type,
      license_number: updatedApplication.license_number,
      location: updatedApplication.location,
      address: updatedApplication.address,
      city: updatedApplication.city,
      country: updatedApplication.country,
      tax_id: updatedApplication.tax_id,
      website: updatedApplication.website,
      description: updatedApplication.description,
      documents: Array.isArray(updatedApplication.documents) ? updatedApplication.documents : [],
      years_in_business: updatedApplication.years_in_business,
      properties_managed: updatedApplication.properties_managed,
      employees_count: updatedApplication.employees_count,
      annual_revenue: updatedApplication.annual_revenue,
      status: updatedApplication.status,
      priority: updatedApplication.priority || 'medium',
      review_notes: updatedApplication.review_notes,
      reviewed_by: updatedApplication.reviewer ? `${updatedApplication.reviewer.first_name} ${updatedApplication.reviewer.last_name}` : null,
      reviewed_at: updatedApplication.reviewed_at?.toISOString() || null,
      submitted_at: updatedApplication.created_at.toISOString(),
      approved_at: updatedApplication.approved_at?.toISOString() || null,
      created_at: updatedApplication.created_at.toISOString(),
      updated_at: updatedApplication.updated_at.toISOString()
    };

    writeSuccess(res, 200, 'Application rejected successfully', transformedApplication);
  } catch (err: any) {
    console.error('Error rejecting application:', err);
    writeError(res, 500, 'Failed to reject application', err.message);
  }
};

// Estimate recipients count for a broadcast based on target audience
export const estimateBroadcastRecipients = async (req: Request, res: Response) => {
  try {
    const { target_audience } = req.query;

    if (!target_audience) {
      return writeError(res, 400, 'target_audience is required');
    }

    // Parse target audience (can be string or comma-separated)
    const targetAudiences = typeof target_audience === 'string'
      ? target_audience.split(',').map((a: string) => a.trim())
      : Array.isArray(target_audience)
      ? target_audience
      : ['all_users'];

    // Build role filter - include all user roles when "all_users" is selected
    const roles: string[] = [];
    if (targetAudiences.includes('all_users')) {
      // Include all user roles
      roles.push(
        'agency_admin',
        'agent',
        'landlord',
        'tenant',
        'caretaker',
        'cleaner',
        'security',
        'maintenance',
        'receptionist',
        'accountant',
        'manager'
      );
    } else {
      if (targetAudiences.includes('agency_admins')) roles.push('agency_admin');
      if (targetAudiences.includes('agents')) roles.push('agent');
      if (targetAudiences.includes('landlords')) roles.push('landlord');
      if (targetAudiences.includes('tenants')) roles.push('tenant');
      if (targetAudiences.includes('caretakers')) roles.push('caretaker');
      // Add support for staff roles
      if (targetAudiences.includes('staff') || targetAudiences.includes('cleaners')) roles.push('cleaner');
      if (targetAudiences.includes('security')) roles.push('security');
      if (targetAudiences.includes('maintenance')) roles.push('maintenance');
      if (targetAudiences.includes('receptionists')) roles.push('receptionist');
      if (targetAudiences.includes('accountants')) roles.push('accountant');
      if (targetAudiences.includes('managers')) roles.push('manager');
    }

    // Count users based on target audience
    const count = await prisma.user.count({
      where: {
        role: { in: roles as any }, // Cast to any to handle enum types
        status: 'active', // Only count active users
        company_id: { not: null }, // Only count users with company_id
      },
    });

    writeSuccess(res, 200, 'Recipient count estimated successfully', {
      estimated_count: count,
      target_audience: targetAudiences,
      roles: roles,
    });
  } catch (err: any) {
    console.error('Error estimating broadcast recipients:', err);
    writeError(res, 500, 'Failed to estimate recipients', err.message);
  }
};

export const getMessagingBroadcasts = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    // Build where clause
    const where: Prisma.BroadcastMessageWhereInput = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // Get broadcasts from database
    const [messages, total] = await Promise.all([
      prisma.broadcastMessage.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.broadcastMessage.count({ where }),
    ]);

    // Transform to match frontend expectations
    const transformedMessages = messages.map((msg: any) => ({
      id: msg.id,
      title: msg.title,
      message: msg.message,
      type: msg.type,
      target_audience: msg.target_audience,
      target_filters: msg.target_filters,
      scheduled_for: msg.scheduled_for?.toISOString(),
      sent_at: msg.sent_at?.toISOString(),
      status: msg.status,
      recipients_count: msg.recipients_count,
      delivered_count: msg.delivered_count,
      opened_count: msg.opened_count,
      send_email: msg.send_email,
      send_sms: msg.send_sms,
      send_push: msg.send_push,
      created_by: msg.created_by,
      created_at: msg.created_at.toISOString(),
      updated_at: msg.updated_at.toISOString(),
      creator: msg.creator ? {
        id: msg.creator.id,
        name: `${msg.creator.first_name} ${msg.creator.last_name}`,
        email: msg.creator.email,
      } : null,
    }));

    const result = {
      messages: transformedMessages,
      total,
      limit,
      offset
    };

    writeSuccess(res, 200, 'Messaging broadcasts retrieved successfully', result);
  } catch (err: any) {
    console.error('Error fetching messaging broadcasts:', err);
    writeError(res, 500, 'Failed to fetch messaging broadcasts', err.message);
  }
};

// Get notification templates
export const getNotificationTemplates = async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;

    // Mock notification templates for demo
    let templates = [
      {
        id: '1',
        name: 'Welcome Email',
        subject: 'Welcome to LetRents!',
        email_body: 'Hello {{user_name}},\n\nWelcome to LetRents! We\'re excited to have you on board.\n\nBest regards,\nThe LetRents Team',
        sms_body: 'Welcome to LetRents, {{user_name}}! We\'re excited to have you.',
        variables: ['user_name', 'agency_name'],
        category: 'notification',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '2',
        name: 'Payment Reminder',
        subject: 'Payment Reminder - {{invoice_amount}}',
        email_body: 'Dear {{user_name}},\n\nThis is a reminder that your payment of {{invoice_amount}} is due on {{due_date}}.\n\nPlease make your payment to avoid any late fees.\n\nThank you!',
        sms_body: 'Reminder: Payment of {{invoice_amount}} due on {{due_date}}. Please pay to avoid late fees.',
        variables: ['user_name', 'invoice_amount', 'due_date'],
        category: 'reminder',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '3',
        name: 'Maintenance Request Update',
        subject: 'Update on Your Maintenance Request',
        email_body: 'Hello {{user_name}},\n\nYour maintenance request #{{request_id}} has been updated to {{status}}.\n\n{{additional_notes}}\n\nThank you for your patience.',
        sms_body: 'Maintenance request #{{request_id}} updated to {{status}}.',
        variables: ['user_name', 'request_id', 'status', 'additional_notes'],
        category: 'notification',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '4',
        name: 'Promotional Offer',
        subject: 'Special Offer Just for You!',
        email_body: 'Hi {{user_name}},\n\nWe have a special promotional offer: {{offer_details}}\n\nDon\'t miss out on this amazing deal!\n\n{{call_to_action}}',
        sms_body: 'Special offer: {{offer_details}}. {{call_to_action}}',
        variables: ['user_name', 'offer_details', 'call_to_action'],
        category: 'promotional',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '5',
        name: 'System Maintenance Notice',
        subject: 'LetRents System Maintenance - {{maintenance_date}}',
        email_body: 'Dear {{user_name}},\n\nWe would like to inform you that LetRents will be undergoing scheduled system maintenance.\n\nMaintenance Details:\n- Date: {{maintenance_date}}\n- Time: {{maintenance_time}}\n- Duration: {{duration}}\n- Impact: {{impact_description}}\n\nDuring this time, you may experience temporary service interruptions. We apologize for any inconvenience and appreciate your patience.\n\nIf you have any urgent matters, please contact our support team.\n\nThank you for your understanding.\n\nThe LetRents Team',
        sms_body: 'LetRents maintenance on {{maintenance_date}} at {{maintenance_time}}. Duration: {{duration}}. {{impact_description}}',
        variables: ['user_name', 'maintenance_date', 'maintenance_time', 'duration', 'impact_description'],
        category: 'system',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '6',
        name: 'System Downtime Alert',
        subject: '⚠️ LetRents System Downtime - {{downtime_date}}',
        email_body: 'URGENT: System Downtime Notice\n\nDear {{user_name}},\n\nThis is an important notification regarding scheduled system downtime for LetRents.\n\nDowntime Information:\n- Start: {{downtime_start}}\n- End: {{downtime_end}}\n- Reason: {{downtime_reason}}\n- Affected Services: {{affected_services}}\n\nPlease plan accordingly as the system will be unavailable during this period. We recommend completing any urgent tasks before the downtime begins.\n\nWe apologize for any inconvenience and thank you for your patience.\n\nFor updates, please visit our status page or contact support.\n\nBest regards,\nThe LetRents Team',
        sms_body: 'URGENT: LetRents downtime {{downtime_start}} to {{downtime_end}}. Reason: {{downtime_reason}}. Plan accordingly.',
        variables: ['user_name', 'downtime_start', 'downtime_end', 'downtime_reason', 'affected_services'],
        category: 'alert',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '7',
        name: 'New Feature Update',
        subject: '🎉 New Feature Available: {{feature_name}}',
        email_body: 'Hello {{user_name}},\n\nWe\'re excited to announce a new feature on LetRents!\n\n✨ New Feature: {{feature_name}}\n\n{{feature_description}}\n\nKey Benefits:\n{{feature_benefits}}\n\nHow to Access:\n{{access_instructions}}\n\nWe hope this enhancement improves your experience with LetRents. If you have any questions or feedback, please don\'t hesitate to reach out.\n\nHappy using!\n\nThe LetRents Team',
        sms_body: 'New LetRents feature: {{feature_name}}. {{feature_description}}. Check it out now!',
        variables: ['user_name', 'feature_name', 'feature_description', 'feature_benefits', 'access_instructions'],
        category: 'promotional',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '8',
        name: 'Risk Alert',
        subject: '🚨 Security Alert: {{alert_title}}',
        email_body: 'SECURITY ALERT\n\nDear {{user_name}},\n\nThis is an important security notification from LetRents.\n\nAlert Type: {{alert_type}}\nSeverity: {{severity_level}}\nIssue: {{alert_description}}\n\nAction Required:\n{{action_required}}\n\nRecommended Steps:\n{{recommended_steps}}\n\nIf you did not initiate this action or notice any suspicious activity, please contact our security team immediately at {{security_contact}}.\n\nYour account security is our top priority.\n\nStay safe,\nThe LetRents Security Team',
        sms_body: 'SECURITY ALERT: {{alert_type}}. {{alert_description}}. Action required: {{action_required}}. Contact: {{security_contact}}',
        variables: ['user_name', 'alert_title', 'alert_type', 'severity_level', 'alert_description', 'action_required', 'recommended_steps', 'security_contact'],
        category: 'alert',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '9',
        name: 'System Update Complete',
        subject: '✅ LetRents System Update Completed',
        email_body: 'Hello {{user_name}},\n\nWe\'re pleased to inform you that the system update has been completed successfully.\n\nUpdate Details:\n- Update Date: {{update_date}}\n- Version: {{version_number}}\n- New Features: {{new_features}}\n- Improvements: {{improvements}}\n- Bug Fixes: {{bug_fixes}}\n\nWhat\'s Changed:\n{{change_summary}}\n\nYou can now enjoy improved performance and new features. If you encounter any issues, please contact our support team.\n\nThank you for your patience during the update.\n\nBest regards,\nThe LetRents Team',
        sms_body: 'LetRents update completed. Version {{version_number}}. New features: {{new_features}}. Check it out!',
        variables: ['user_name', 'update_date', 'version_number', 'new_features', 'improvements', 'bug_fixes', 'change_summary'],
        category: 'system',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '10',
        name: 'Emergency System Alert',
        subject: '🚨 EMERGENCY: {{emergency_title}}',
        email_body: 'EMERGENCY ALERT\n\nDear {{user_name}},\n\nThis is an emergency notification from LetRents.\n\nEmergency Type: {{emergency_type}}\nStatus: {{emergency_status}}\nDescription: {{emergency_description}}\n\nImmediate Actions:\n{{immediate_actions}}\n\nWhat to Do:\n{{what_to_do}}\n\nFor Assistance:\n{{assistance_contact}}\n\nPlease follow all instructions carefully. Your safety and data security are our priorities.\n\nStay informed,\nThe LetRents Emergency Response Team',
        sms_body: 'EMERGENCY: {{emergency_type}}. {{emergency_description}}. Actions: {{immediate_actions}}. Contact: {{assistance_contact}}',
        variables: ['user_name', 'emergency_title', 'emergency_type', 'emergency_status', 'emergency_description', 'immediate_actions', 'what_to_do', 'assistance_contact'],
        category: 'alert',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
      {
        id: '11',
        name: 'Service Status Update',
        subject: 'LetRents Service Status Update',
        email_body: 'Hello {{user_name}},\n\nWe wanted to keep you informed about the current status of LetRents services.\n\nService Status: {{service_status}}\nStatus Date: {{status_date}}\nAffected Services: {{affected_services}}\n\nCurrent Status:\n{{status_description}}\n\nExpected Resolution:\n{{expected_resolution}}\n\nWe are working diligently to resolve any issues and restore full service. Thank you for your patience.\n\nFor real-time updates, please visit our status page.\n\nBest regards,\nThe LetRents Team',
        sms_body: 'LetRents status update: {{service_status}}. {{status_description}}. Expected resolution: {{expected_resolution}}',
        variables: ['user_name', 'service_status', 'status_date', 'affected_services', 'status_description', 'expected_resolution'],
        category: 'system',
        is_active: true,
        created_by: 'system',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2025-01-01T00:00:00Z').toISOString(),
      },
    ];

    // Filter by category if provided
    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    writeSuccess(res, 200, 'Notification templates retrieved successfully', templates);
  } catch (err: any) {
    console.error('Error fetching notification templates:', err);
    writeError(res, 500, 'Failed to fetch notification templates', err.message);
  }
};

// Create notification template
export const createNotificationTemplate = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const templateData = {
      ...req.body,
      id: `template_${Date.now()}`,
      created_by: user?.id || 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      variables: req.body.variables || [],
    };

    writeSuccess(res, 201, 'Notification template created successfully', templateData);
  } catch (err: any) {
    console.error('Error creating notification template:', err);
    writeError(res, 500, 'Failed to create notification template', err.message);
  }
};

// Update notification template
export const updateNotificationTemplate = async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    writeSuccess(res, 200, 'Notification template updated successfully', { id: templateId, ...updates });
  } catch (err: any) {
    console.error('Error updating notification template:', err);
    writeError(res, 500, 'Failed to update notification template', err.message);
  }
};

// Send broadcast message
export const sendBroadcastMessage = async (req: Request, res: Response) => {
  try {
    const messageId = req.params.id;
    const user = (req as any).user;
    
    // Get broadcast from database
    const broadcast = await prisma.broadcastMessage.findUnique({
      where: { id: messageId },
    });

    if (!broadcast) {
      return writeError(res, 404, 'Broadcast message not found');
    }

    if (broadcast.status === 'sent') {
      return writeError(res, 400, 'Broadcast message has already been sent');
    }

    // Parse target audience (can be string or comma-separated)
    const targetAudiences = typeof broadcast.target_audience === 'string'
      ? broadcast.target_audience.split(',').map((a: string) => a.trim())
      : Array.isArray(broadcast.target_audience)
      ? broadcast.target_audience
      : ['all_users'];

    // Build role filter - include all user roles when "all_users" is selected
    const roles: string[] = [];
    if (targetAudiences.includes('all_users')) {
      // Include all user roles: agency_admin, agent, landlord, tenant, caretaker, cleaner, security, maintenance, receptionist, accountant, manager
      roles.push(
        'agency_admin',
        'agent',
        'landlord',
        'tenant',
        'caretaker',
        'cleaner',
        'security',
        'maintenance',
        'receptionist',
        'accountant',
        'manager'
      );
    } else {
      if (targetAudiences.includes('agency_admins')) roles.push('agency_admin');
      if (targetAudiences.includes('agents')) roles.push('agent');
      if (targetAudiences.includes('landlords')) roles.push('landlord');
      if (targetAudiences.includes('tenants')) roles.push('tenant');
      if (targetAudiences.includes('caretakers')) roles.push('caretaker');
      // Add support for staff roles
      if (targetAudiences.includes('staff') || targetAudiences.includes('cleaners')) roles.push('cleaner');
      if (targetAudiences.includes('security')) roles.push('security');
      if (targetAudiences.includes('maintenance')) roles.push('maintenance');
      if (targetAudiences.includes('receptionists')) roles.push('receptionist');
      if (targetAudiences.includes('accountants')) roles.push('accountant');
      if (targetAudiences.includes('managers')) roles.push('manager');
    }

    // Get users based on target audience
    const whereClause: any = {
      role: { in: roles },
      status: 'active', // Only send to active users
    };

    const recipients = await prisma.user.findMany({
      where: {
        ...whereClause,
        company_id: { not: null }, // Only get users with company_id
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        company_id: true,
      },
    });

    console.log(`📢 Sending broadcast to ${recipients.length} recipients`);

    // Helper function to escape HTML to prevent XSS
    const escapeHtml = (text: string): string => {
      if (!text) return text;
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Helper function to replace template variables with user data
    const replaceTemplateVariables = (text: string, recipient: any): string => {
      if (!text) return text;
      
      const userFullName = `${recipient.first_name} ${recipient.last_name}`.trim();
      
      // Replace common template variables
      let replaced = text
        .replace(/\{\{user_name\}\}/gi, userFullName)
        .replace(/\{\{user_first_name\}\}/gi, recipient.first_name || '')
        .replace(/\{\{user_last_name\}\}/gi, recipient.last_name || '')
        .replace(/\{\{first_name\}\}/gi, recipient.first_name || '')
        .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
        .replace(/\{\{name\}\}/gi, userFullName)
        .replace(/\{\{email\}\}/gi, recipient.email || '')
        .replace(/\{\{user_email\}\}/gi, recipient.email || '')
        .replace(/\{\{role\}\}/gi, recipient.role || '');
      
      return replaced;
    };

    // Import email service
    const { emailService } = await import('../services/email.service.js');

    let deliveredCount = 0;
    let emailSentCount = 0;
    let notificationCreatedCount = 0;

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        // Replace template variables for this recipient
        const personalizedTitle = replaceTemplateVariables(broadcast.title, recipient);
        const personalizedMessage = replaceTemplateVariables(broadcast.message, recipient);

        // Create in-app notification
        if (broadcast.send_push !== false) {
          try {
            // Create notification directly using Prisma (bypass service for cross-company broadcasts)
            // Only create notification if recipient has a company_id
            if (recipient.company_id) {
              await prisma.notification.create({
                data: {
                  title: personalizedTitle,
                  message: personalizedMessage,
                  notification_type: broadcast.type || 'info',
                  category: broadcast.type || 'general',
                  priority: broadcast.type === 'alert' ? 'high' : 'medium',
                  sender_id: user?.user_id || null,
                  recipient_id: recipient.id,
                  company_id: recipient.company_id,
                  is_read: false,
                  status: 'unread',
                },
              });
              notificationCreatedCount++;
            }
          } catch (notifError) {
            console.error(`Failed to create notification for user ${recipient.id}:`, notifError);
          }
        }

        // Send email if requested
        if (broadcast.send_email && recipient.email) {
          try {
            await emailService.sendEmail({
              to: recipient.email,
              subject: personalizedTitle,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #14b8a6;">${escapeHtml(personalizedTitle)}</h2>
                  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(personalizedMessage).replace(/\n/g, '<br>')}</p>
                  </div>
                  <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                    This is an automated message from LetRents System.
                  </p>
                </div>
              `,
              text: personalizedMessage,
            });
            emailSentCount++;
          } catch (emailError) {
            console.error(`Failed to send email to ${recipient.email}:`, emailError);
          }
        }

        deliveredCount++;
      } catch (error) {
        console.error(`Error sending to recipient ${recipient.id}:`, error);
      }
    }

    // Update broadcast status in database
    const updatedBroadcast = await prisma.broadcastMessage.update({
      where: { id: messageId },
      data: {
        status: 'sent',
        sent_at: new Date(),
        recipients_count: recipients.length,
        delivered_count: deliveredCount,
        updated_at: new Date(),
      },
    });

    console.log(`✅ Broadcast sent: ${notificationCreatedCount} notifications, ${emailSentCount} emails`);

    writeSuccess(res, 200, 'Broadcast message sent successfully', {
      id: messageId,
      status: 'sent',
      sent_at: updatedBroadcast.sent_at?.toISOString(),
      recipients_count: recipients.length,
      delivered_count: deliveredCount,
      notifications_created: notificationCreatedCount,
      emails_sent: emailSentCount,
    });
  } catch (err: any) {
    console.error('Error sending broadcast message:', err);
    writeError(res, 500, 'Failed to send broadcast message', err.message);
  }
};

// Schedule broadcast message
export const scheduleBroadcastMessage = async (req: Request, res: Response) => {
  try {
    const messageId = req.params.id;
    const { scheduled_for } = req.body;
    
    if (!scheduled_for) {
      return writeError(res, 400, 'scheduled_for is required');
    }

    // Get broadcast from database
    const broadcast = await prisma.broadcastMessage.findUnique({
      where: { id: messageId },
    });

    if (!broadcast) {
      return writeError(res, 404, 'Broadcast message not found');
    }

    // Update broadcast with scheduled time
    const updatedBroadcast = await prisma.broadcastMessage.update({
      where: { id: messageId },
      data: {
        status: 'scheduled',
        scheduled_for: new Date(scheduled_for),
        updated_at: new Date(),
      },
    });
    
    writeSuccess(res, 200, 'Broadcast message scheduled successfully', { 
      id: messageId,
      status: 'scheduled',
      scheduled_for: updatedBroadcast.scheduled_for?.toISOString(),
    });
  } catch (err: any) {
    console.error('Error scheduling broadcast message:', err);
    writeError(res, 500, 'Failed to schedule broadcast message', err.message);
  }
};

// Create broadcast message
export const createBroadcastMessage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.user_id || user?.id;
    
    if (!userId) {
      return writeError(res, 401, 'User authentication required');
    }

    // Validate required fields
    if (!req.body.title || !req.body.message) {
      return writeError(res, 400, 'Title and message are required');
    }

    // Handle target_audience - convert array to comma-separated string if needed
    let targetAudience = req.body.target_audience;
    if (Array.isArray(targetAudience)) {
      targetAudience = targetAudience.join(',');
    } else if (!targetAudience) {
      targetAudience = 'all_users';
    }

    // Create broadcast in database
    const broadcastData = await prisma.broadcastMessage.create({
      data: {
        title: req.body.title,
        message: req.body.message,
        type: req.body.type || 'notification',
        target_audience: targetAudience,
        target_filters: req.body.target_filters || null,
        status: 'draft',
        recipients_count: 0,
        delivered_count: 0,
        opened_count: 0,
        send_email: req.body.send_email !== undefined ? req.body.send_email : true,
        send_sms: req.body.send_sms !== undefined ? req.body.send_sms : false,
        send_push: req.body.send_push !== undefined ? req.body.send_push : true,
        created_by: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Transform to match frontend expectations
    const response = {
      id: broadcastData.id,
      title: broadcastData.title,
      message: broadcastData.message,
      type: broadcastData.type,
      target_audience: broadcastData.target_audience,
      target_filters: broadcastData.target_filters,
      scheduled_for: broadcastData.scheduled_for?.toISOString(),
      sent_at: broadcastData.sent_at?.toISOString(),
      status: broadcastData.status,
      recipients_count: broadcastData.recipients_count,
      delivered_count: broadcastData.delivered_count,
      opened_count: broadcastData.opened_count,
      send_email: broadcastData.send_email,
      send_sms: broadcastData.send_sms,
      send_push: broadcastData.send_push,
      created_by: broadcastData.created_by,
      created_at: broadcastData.created_at.toISOString(),
      updated_at: broadcastData.updated_at.toISOString(),
      creator: broadcastData.creator ? {
        id: broadcastData.creator.id,
        name: `${broadcastData.creator.first_name} ${broadcastData.creator.last_name}`,
        email: broadcastData.creator.email,
      } : null,
    };

    writeSuccess(res, 201, 'Broadcast message created successfully', response);
  } catch (err: any) {
    console.error('Error creating broadcast message:', err);
    writeError(res, 500, 'Failed to create broadcast message', err.message);
  }
};

// Get agency billing data
export const getAgencyBilling = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;

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

      // Calculate subscription revenue from paid invoices
      let subscriptionRevenue = 0;
      if (subscription) {
        const paidInvoices = subscription.billing_invoices.filter(inv => inv.status === 'paid');
        subscriptionRevenue = paidInvoices.reduce((sum, invoice) => {
          return sum + (Number(invoice.amount) || 0);
        }, 0);
        
        // If subscription was created from payment and has amount, include it
        const subscriptionMetadata = subscription.metadata as any || {};
        if (subscriptionMetadata.created_from_payment && subscription.amount) {
          // Only add if not already counted in invoices
          const alreadyCounted = paidInvoices.some(inv => 
            Math.abs(Number(inv.amount) - Number(subscription.amount)) < 0.01
          );
          if (!alreadyCounted) {
            subscriptionRevenue += Number(subscription.amount || 0);
          }
        }
      }

      // Calculate rental revenue from occupied units
      const occupiedUnits = await prisma.unit.findMany({
        where: {
          status: 'occupied',
          property: { agency_id: agency.id }
        },
        select: {
          rent_amount: true
        }
      });

      const rentalRevenue = occupiedUnits.reduce((sum, unit) => {
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
      let dueDate: Date | null = null;
      let lastPayment: Date | null = null;
      let currentPeriod: string | null = null;

      if (subscription) {
        // Get the latest paid invoice
        const paidInvoices = subscription.billing_invoices.filter(inv => inv.status === 'paid');
        if (paidInvoices.length > 0) {
          // Sort by paid_at first, then by updated_at as fallback
          const latestPaidInvoice = paidInvoices.sort((a, b) => {
            const aDate = a.paid_at?.getTime() || a.updated_at.getTime();
            const bDate = b.paid_at?.getTime() || b.updated_at.getTime();
            return bDate - aDate;
          })[0];
          
          // Use paid_at if available, otherwise use updated_at for paid invoices
          if (latestPaidInvoice?.paid_at) {
            lastPayment = latestPaidInvoice.paid_at;
          } else if (latestPaidInvoice?.updated_at) {
            // Fallback to updated_at for paid invoices (they were likely marked as paid at that time)
            lastPayment = latestPaidInvoice.updated_at;
          }
        }
        
        // If still no lastPayment, check all invoices (including pending/overdue) for any payment activity
        if (!lastPayment && subscription.billing_invoices.length > 0) {
          // Look for any invoice that might have payment info
          const invoicesWithPayment = subscription.billing_invoices
            .filter(inv => inv.paid_at || (inv.status === 'paid' && inv.updated_at))
            .sort((a, b) => {
              const aDate = a.paid_at?.getTime() || a.updated_at.getTime();
              const bDate = b.paid_at?.getTime() || b.updated_at.getTime();
              return bDate - aDate;
            });
          
          if (invoicesWithPayment.length > 0) {
            const latest = invoicesWithPayment[0];
            lastPayment = latest.paid_at || latest.updated_at;
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
          } else {
            paymentStatus = 'pending';
          }
        } else if (subscription.next_billing_date) {
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
            } else if (subscription.next_billing_date <= now) {
              paymentStatus = 'pending';
            }
          } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            paymentStatus = 'overdue';
          } else if (subscription.status === 'canceled') {
            paymentStatus = 'pending';
          }
        } else {
          // No next billing date - likely trial or new subscription
          if (subscription.status === 'trial') {
            paymentStatus = 'paid'; // Trial is considered paid
          } else if (subscription.status === 'active' && outstandingAmount === 0) {
            paymentStatus = 'paid';
          }
        }
      } else {
        // No subscription - mark as pending
        paymentStatus = 'pending';
      }

      // Determine plan name from subscription
      const planName = subscription?.plan
        ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
        : 'No Plan';

      // Get monthly fee (subscription amount)
      const monthlyFee = subscription ? Number(subscription.amount || 0) : 0;

      // Extract payment channel information from subscription metadata
      const subscriptionMetadata = subscription?.metadata as any || {};
      const paymentChannel = subscriptionMetadata.payment_channel_display || subscriptionMetadata.payment_channel;
      const gateway = subscription?.gateway;
      
      // Format payment method with channel info if available
      // Use string type to allow formatted payment method with channel details
      let paymentMethod: string = 'N/A';
      if (gateway) {
        if (gateway === 'paystack' && paymentChannel) {
          paymentMethod = `Paystack - ${paymentChannel}`;
        } else if (gateway === 'paystack') {
          paymentMethod = 'Paystack';
        } else {
          // Capitalize first letter for other gateways
          paymentMethod = gateway.charAt(0).toUpperCase() + gateway.slice(1);
        }
      }

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
        paymentMethod: paymentMethod,
        totalRevenue: subscriptionRevenue, // Subscription revenue (for backward compatibility)
        subscriptionRevenue: subscriptionRevenue, // Explicit subscription revenue
        rentalRevenue: rentalRevenue, // Rental revenue from occupied units
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
    const totalSubscriptionRevenue = billingData.reduce((sum, a) => sum + (a.subscriptionRevenue || a.totalRevenue || 0), 0);
    const totalRentalRevenue = billingData.reduce((sum, a) => sum + (a.rentalRevenue || 0), 0);
    const totalRevenue = totalSubscriptionRevenue; // Keep for backward compatibility
    const totalOutstanding = billingData.reduce((sum, a) => sum + a.outstandingAmount, 0);

    const result = {
      agencies: filteredData,
      summary: {
        total: totalAgencies,
        paid: paidAgencies,
        pending: pendingAgencies,
        overdue: overdueAgencies,
        totalRevenue: totalRevenue, // Subscription revenue (for backward compatibility)
        subscriptionRevenue: totalSubscriptionRevenue,
        rentalRevenue: totalRentalRevenue,
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
  } catch (err: any) {
    console.error('Error fetching agency billing:', err);
    writeError(res, 500, 'Failed to fetch agency billing', err.message);
  }
};

// Get landlord billing data
export const getLandlordBilling = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;

    console.log('💳 Fetching landlord billing data...');

    // Get all landlords (users with role='landlord') with their companies and subscriptions
    // CRITICAL: Only get landlords that have a company_id
    const landlords = await prisma.user.findMany({
      where: {
        role: 'landlord',
        company_id: { not: null } // Ensure company_id exists
      },
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
        }
      }
    });

    const now = new Date();
    const billingData = [];

    for (const landlord of landlords) {
      const subscription = landlord.company?.subscriptions?.[0] || null;
      const company = landlord.company;

      if (!company) {
        console.warn(`⚠️ Landlord ${landlord.id} has no company, skipping...`);
        continue;
      }

      // Get properties and units counts for this landlord's company
      const [propertiesCount, unitsCount] = await Promise.all([
        prisma.property.count({ where: { company_id: company.id } }),
        prisma.unit.count({
          where: {
            property: { company_id: company.id }
          }
        })
      ]);

      // Calculate subscription revenue from paid invoices
      let subscriptionRevenue = 0;
      if (subscription) {
        const paidInvoices = subscription.billing_invoices.filter(inv => inv.status === 'paid');
        subscriptionRevenue = paidInvoices.reduce((sum, invoice) => {
          return sum + (Number(invoice.amount) || 0);
        }, 0);
        
        // If subscription was created from payment and has amount, include it
        const subscriptionMetadata = subscription.metadata as any || {};
        if (subscriptionMetadata.created_from_payment && subscription.amount) {
          // Only add if not already counted in invoices
          const alreadyCounted = paidInvoices.some(inv => 
            Math.abs(Number(inv.amount) - Number(subscription.amount)) < 0.01
          );
          if (!alreadyCounted) {
            subscriptionRevenue += Number(subscription.amount || 0);
          }
        }
      }

      // Calculate rental revenue from occupied units
      const occupiedUnits = await prisma.unit.findMany({
        where: {
          status: 'occupied',
          property: { company_id: company.id }
        },
        select: {
          rent_amount: true
        }
      });

      const rentalRevenue = occupiedUnits.reduce((sum, unit) => {
        return sum + (Number(unit.rent_amount) || 0);
      }, 0);

      // Get outstanding invoices (unpaid or overdue)
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
      let dueDate: Date | null = null;
      let lastPayment: Date | null = null;
      let currentPeriod: string | null = null;

      if (subscription) {
        // Get the latest paid invoice
        const paidInvoices = subscription.billing_invoices.filter(inv => inv.status === 'paid');
        if (paidInvoices.length > 0) {
          const latestPaidInvoice = paidInvoices.sort((a, b) => {
            const aDate = a.paid_at?.getTime() || a.updated_at.getTime();
            const bDate = b.paid_at?.getTime() || b.updated_at.getTime();
            return bDate - aDate;
          })[0];
          
          if (latestPaidInvoice?.paid_at) {
            lastPayment = latestPaidInvoice.paid_at;
          } else if (latestPaidInvoice?.updated_at) {
            lastPayment = latestPaidInvoice.updated_at;
          }
        }
        
        if (!lastPayment && subscription.billing_invoices.length > 0) {
          const invoicesWithPayment = subscription.billing_invoices
            .filter(inv => inv.paid_at || (inv.status === 'paid' && inv.updated_at))
            .sort((a, b) => {
              const aDate = a.paid_at?.getTime() || a.updated_at.getTime();
              const bDate = b.paid_at?.getTime() || b.updated_at.getTime();
              return bDate - aDate;
            });
          
          if (invoicesWithPayment.length > 0) {
            const latest = invoicesWithPayment[0];
            lastPayment = latest.paid_at || latest.updated_at;
          }
        }

        // Check if there are outstanding invoices
        if (outstandingInvoices.length > 0) {
          const latestOutstanding = outstandingInvoices
            .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];

          dueDate = new Date(latestOutstanding.due_date);
          const periodStart = new Date(latestOutstanding.billing_period_start);
          const periodEnd = new Date(latestOutstanding.billing_period_end);
          currentPeriod = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;

          if (latestOutstanding.status === 'overdue' || dueDate < now) {
            paymentStatus = 'overdue';
          } else {
            paymentStatus = 'pending';
          }
        } else if (subscription.next_billing_date) {
          dueDate = new Date(subscription.next_billing_date);
          
          const cycleDays = subscription.billing_cycle === 'monthly' ? 30 : 365;
          const periodStart = new Date(subscription.next_billing_date);
          periodStart.setDate(periodStart.getDate() - cycleDays);
          const periodEnd = new Date(subscription.next_billing_date);
          currentPeriod = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;

          if (subscription.status === 'active') {
            if (subscription.next_billing_date > now && outstandingAmount === 0) {
              paymentStatus = 'paid';
            } else if (subscription.next_billing_date <= now) {
              paymentStatus = 'pending';
            }
          } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            paymentStatus = 'overdue';
          } else if (subscription.status === 'canceled') {
            paymentStatus = 'pending';
          }
        } else {
          if (subscription.status === 'trial') {
            paymentStatus = 'paid';
          } else if (subscription.status === 'active' && outstandingAmount === 0) {
            paymentStatus = 'paid';
          }
        }
      } else {
        paymentStatus = 'pending';
      }

      // Determine plan name from subscription
      const planName = subscription?.plan
        ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
        : 'No Plan';

      // Get monthly fee (subscription amount)
      const monthlyFee = subscription ? Number(subscription.amount || 0) : 0;

      // Extract payment channel information from subscription metadata
      const subscriptionMetadata = subscription?.metadata as any || {};
      const paymentChannel = subscriptionMetadata.payment_channel_display || subscriptionMetadata.payment_channel;
      const gateway = subscription?.gateway;
      
      let paymentMethod: string = 'N/A';
      if (gateway) {
        if (gateway === 'paystack' && paymentChannel) {
          paymentMethod = `Paystack - ${paymentChannel}`;
        } else if (gateway === 'paystack') {
          paymentMethod = 'Paystack';
        } else {
          paymentMethod = gateway.charAt(0).toUpperCase() + gateway.slice(1);
        }
      }

      billingData.push({
        id: landlord.id,
        name: `${landlord.first_name} ${landlord.last_name}`.trim() || landlord.email,
        email: landlord.email,
        plan: planName,
        monthlyFee: monthlyFee,
        propertiesCount: propertiesCount,
        unitsCount: unitsCount,
        currentPeriod: currentPeriod,
        status: paymentStatus,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
        lastPayment: lastPayment ? lastPayment.toISOString().split('T')[0] : null,
        paymentMethod: paymentMethod,
        totalRevenue: subscriptionRevenue, // Subscription revenue (for backward compatibility)
        subscriptionRevenue: subscriptionRevenue, // Explicit subscription revenue
        rentalRevenue: rentalRevenue, // Rental revenue from occupied units
        outstandingAmount: outstandingAmount,
        subscriptionStatus: subscription?.status || 'none',
        subscriptionId: subscription?.id || null,
        companyId: company.id
      });
    }

    // Filter by status if provided
    let filteredData = billingData;
    if (status && status !== 'all') {
      filteredData = billingData.filter(item => item.status === status);
    }

    // Calculate summary statistics
    const totalLandlords = billingData.length;
    const paidLandlords = billingData.filter(l => l.status === 'paid').length;
    const overdueLandlords = billingData.filter(l => l.status === 'overdue').length;
    const pendingLandlords = billingData.filter(l => l.status === 'pending').length;
    const totalSubscriptionRevenue = billingData.reduce((sum, l) => sum + (l.subscriptionRevenue || l.totalRevenue || 0), 0);
    const totalRentalRevenue = billingData.reduce((sum, l) => sum + (l.rentalRevenue || 0), 0);
    const totalRevenue = totalSubscriptionRevenue; // Keep for backward compatibility
    const totalOutstanding = billingData.reduce((sum, l) => sum + l.outstandingAmount, 0);

    const result = {
      landlords: filteredData,
      summary: {
        total: totalLandlords,
        paid: paidLandlords,
        pending: pendingLandlords,
        overdue: overdueLandlords,
        totalRevenue: totalRevenue, // Subscription revenue (for backward compatibility)
        subscriptionRevenue: totalSubscriptionRevenue,
        rentalRevenue: totalRentalRevenue,
        totalOutstanding: totalOutstanding
      }
    };

    console.log('✅ Landlord billing data retrieved:', {
      total: totalLandlords,
      paid: paidLandlords,
      pending: pendingLandlords,
      overdue: overdueLandlords
    });

    writeSuccess(res, 200, 'Landlord billing data retrieved successfully', result);
  } catch (err: any) {
    console.error('Error fetching landlord billing:', err);
    writeError(res, 500, 'Failed to fetch landlord billing', err.message);
  }
};

// Billing Subscriptions and Invoices
export const getBillingSubscriptions = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

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
    const transformedSubscriptions = await Promise.all(
      subscriptions.map(async (sub) => {
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
      })
    );

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
  } catch (err: any) {
    console.error('Error fetching billing subscriptions:', err);
    writeError(res, 500, 'Failed to fetch billing subscriptions', err.message);
  }
};

export const getBillingInvoices = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

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
  } catch (err: any) {
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
export const activateEntity = async (req: Request, res: Response) => {
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
    } else if (entityType === 'company') {
      const company = await prisma.company.update({
        where: { id: entityId },
        data: { 
          status: 'active',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Company activated successfully', company);
    } else if (entityType === 'agency') {
      const agency = await prisma.agency.update({
        where: { id: entityId },
        data: { 
          status: 'active',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Agency activated successfully', agency);
    } else {
      writeError(res, 400, 'Invalid entity type');
    }
  } catch (err: any) {
    console.error('Error activating entity:', err);
    writeError(res, 500, 'Failed to activate entity', err.message);
  }
};

/**
 * Deactivate a user or company
 */
export const deactivateEntity = async (req: Request, res: Response) => {
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
    } else if (entityType === 'company') {
      const company = await prisma.company.update({
        where: { id: entityId },
        data: { 
          status: 'inactive',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Company deactivated successfully', company);
    } else if (entityType === 'agency') {
      const agency = await prisma.agency.update({
        where: { id: entityId },
        data: { 
          status: 'inactive',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Agency deactivated successfully', agency);
    } else {
      writeError(res, 400, 'Invalid entity type');
    }
  } catch (err: any) {
    console.error('Error deactivating entity:', err);
    writeError(res, 500, 'Failed to deactivate entity', err.message);
  }
};

/**
 * Suspend a user or company
 */
export const suspendEntity = async (req: Request, res: Response) => {
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
    } else if (entityType === 'company') {
      const company = await prisma.company.update({
        where: { id: entityId },
        data: { 
          status: 'suspended',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Company suspended successfully', company);
    } else if (entityType === 'agency') {
      const agency = await prisma.agency.update({
        where: { id: entityId },
        data: { 
          status: 'suspended',
          updated_at: new Date()
        }
      });
      writeSuccess(res, 200, 'Agency suspended successfully', agency);
    } else {
      writeError(res, 400, 'Invalid entity type');
    }
  } catch (err: any) {
    console.error('Error suspending entity:', err);
    writeError(res, 500, 'Failed to suspend entity', err.message);
  }
};

/**
 * Send invitation to user
 */
export const sendInvitation = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { resend } = req.query;
    const user = (req as any).user; // Get authenticated user from middleware

    console.log(`📧 ${resend ? 'Resending' : 'Sending'} invitation to ${entityType} ${entityId}`);

    // Get user/entity details
    let email = '';
    let name = '';
    let entityData: any = null;
    let userData: any = null;
    let userRole: string = '';

    if (entityType === 'user') {
      userData = await prisma.user.findUnique({ where: { id: entityId } });
      if (!userData) {
        return writeError(res, 404, 'User not found');
      }
      entityData = userData;
      email = userData.email || '';
      name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || email;
      userRole = userData.role || '';
    } else if (entityType === 'agency') {
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
      } else {
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
    } else {
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

    // Define team member roles (SaaS team, not customers)
    const TEAM_MEMBER_ROLES = ['admin', 'manager', 'team_lead', 'staff', 'finance', 'sales', 'marketing', 'support', 'hr', 'auditor'];
    const isTeamMember = userData && TEAM_MEMBER_ROLES.includes(userRole);

    let tempPassword: string | null = null;
    let needsPasswordReset = false;
    let needsSetupLink = false;

    // For users, check if they need a password or password reset
    if (userData) {
      const hasPassword = !!userData.password_hash;
      const isPending = userData.status === 'pending' || userData.status === 'pending_setup';
      const isEmailVerified = userData.email_verified;

      // For team members, send setup link instead of temporary password (like tenants)
      if (isTeamMember && (!hasPassword || isPending)) {
        // Don't generate password - user will set it via setup link
        // Set status to pending and verify email (they'll set password via link)
        await prisma.user.update({
          where: { id: userData.id },
          data: {
            status: 'pending', // User needs to set up their account via link
            email_verified: true, // Verify email since we're sending link to their email
            updated_at: new Date()
          }
        });

        needsSetupLink = true;
        console.log(`📧 Sending setup link for team member ${userData.id} (no temporary password)`);
      } else if (!isTeamMember && (!hasPassword || isPending)) {
        // For non-team members (customers), generate temporary password
        tempPassword = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
        const passwordHash = await bcrypt.default.hash(tempPassword, 10);
        
        await prisma.user.update({
          where: { id: userData.id },
          data: {
            password_hash: passwordHash,
            status: 'pending_setup',
            email_verified: true,
            updated_at: new Date()
          }
        });

        needsPasswordReset = true;
        console.log(`🔑 Generated temporary password for user ${userData.id} and verified email (required for login)`);
      } else if (!isEmailVerified && hasPassword) {
        // User has password but email is not verified - send verification email instead
        console.log(`📧 User ${userData.id} has password but email not verified - sending verification email`);
      }
    }

    // Determine email type and content based on user status
    const isAgencyAdmin = userRole === 'agency_admin';
    const isLandlord = userRole === 'landlord';
    const loginUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/login`;
    const appName = 'LetRents';

    // Map user roles to display names for team members
    const getRoleDisplayName = (role: string): string => {
      const roleMap: Record<string, string> = {
        'super_admin': 'Super Administrator',
        'agency_admin': 'Agency Administrator',
        'landlord': 'Landlord',
        'agent': 'Agent',
        'caretaker': 'Caretaker',
        'team_lead': 'Team Lead',
        'manager': 'Manager',
        'staff': 'Staff Member',
        'finance': 'Finance Team Member',
        'sales': 'Sales Team Member',
        'marketing': 'Marketing Team Member',
        'support': 'Support Team Member',
        'hr': 'HR Team Member',
        'auditor': 'Auditor',
        'admin': 'Administrator',
        'tenant': 'Tenant'
      };
      return roleMap[role] || 'Team Member';
    };

    let emailSubject = '';
    let emailHtml = '';
    let emailText = '';

    // For team members, send setup link email (like tenants)
    if (needsSetupLink && isTeamMember) {
      const roleDisplayName = getRoleDisplayName(userRole);
      const setupLink = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/account/setup?token=invitation-${userData.id}&email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(userData.first_name || '')}&last_name=${encodeURIComponent(userData.last_name || '')}`;
      
      emailSubject = `Welcome to ${appName} - Complete Your Account Setup`;
      
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
            .info { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 8px; margin: 25px 0; }
            .info strong { color: #0066cc; }
            h1 { margin: 0; font-size: 28px; font-weight: 700; }
            h2 { margin: 0 0 15px; color: #1e293b; font-size: 20px; font-weight: 600; }
            p { margin: 0 0 15px; color: #475569; font-size: 16px; }
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
              <p>To get started, please complete your account setup by creating a secure password using the link below.</p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${setupLink}" class="button">Complete Account Setup</a>
              </div>

              <div class="info">
                <strong>📋 What to Expect:</strong>
                <ul>
                  <li>Click the button above to access your account setup page</li>
                  <li>Create a secure password for your account</li>
                  <li>You'll be automatically logged in after setup</li>
                  <li>If you didn't expect this invitation, please contact our support team immediately</li>
                </ul>
              </div>

              <p style="margin-top: 25px;"><strong>Setup Link:</strong> <a href="${setupLink}" style="color: #2563eb; word-break: break-all;">${setupLink}</a></p>

              <h3 style="margin-top: 35px;">What's Next?</h3>
              <ol style="color: #475569; padding-left: 20px;">
                <li>Click the "Complete Account Setup" button above</li>
                <li>Create a secure password for your account</li>
                <li>You'll be automatically logged in</li>
                <li>Complete your profile setup</li>
                <li>Start using ${appName}!</li>
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

To get started, please complete your account setup by creating a secure password using the link below.

Setup Link: ${setupLink}

What to Expect:
- Click the link above to access your account setup page
- Create a secure password for your account
- You'll be automatically logged in after setup
- If you didn't expect this invitation, please contact our support team immediately

What's Next?
1. Click the setup link above
2. Create a secure password for your account
3. You'll be automatically logged in
4. Complete your profile setup
5. Start using ${appName}!

If you have any questions or need assistance, please don't hesitate to contact our support team.

Welcome to the ${appName} family!

Best regards,
The ${appName} Team

---
© ${new Date().getFullYear()} ${appName}. All rights reserved.
This is an automated invitation email. Please do not reply to this email.`;

    } else if (needsPasswordReset && tempPassword) {
      // Send invitation email with temporary password
      emailSubject = `Welcome to ${appName} - Complete Your Account Setup`;
      
      const roleDisplayName = getRoleDisplayName(userRole);
      
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

    } else if (userData && userData.email_verified === false) {
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
          email: userData.email!,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          is_used: false,
        }
      });

      const verificationUrl = `${env.appUrl || process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
      
      // Use the email service's sendVerificationEmail method
      const emailResult = await authEmailService.sendVerificationEmail(
        userData.email!,
        verificationUrl,
        name
      );

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

    } else {
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
    } else if (entityType === 'agency') {
      await prisma.agency.update({
        where: { id: entityId },
        data: { updated_at: new Date() }
      });
    }

    writeSuccess(res, 200, `Invitation ${resend ? 'resent' : 'sent'} successfully`, {
      email,
      name,
      type: needsSetupLink ? 'setup_link' : tempPassword ? 'password_reset' : 'welcome',
      sent_at: new Date(),
      ...(tempPassword && process.env.NODE_ENV === 'development' ? { temp_password: tempPassword } : {})
    });
  } catch (err: any) {
    console.error('Error sending invitation:', err);
    writeError(res, 500, 'Failed to send invitation', err.message);
  }
};

/**
 * Get subscription details for a company/agency
 */
export const getEntitySubscription = async (req: Request, res: Response) => {
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
    } else if (entityType === 'agency') {
      // Agencies belong to companies, so get the agency's company_id
      const agency = await prisma.agency.findUnique({ 
        where: { id: entityId },
        select: { company_id: true }
      });
      if (!agency || !agency.company_id) {
        return writeError(res, 404, 'Agency not found or has no associated company');
      }
      companyId = agency.company_id; // Use the agency's company_id for subscription lookup
    }

    // Get subscription with related data
    const subscription = await prisma.subscription.findFirst({
      where: { company_id: companyId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        billing_invoices: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
      orderBy: { created_at: 'desc' }
    });

    if (!subscription) {
      return writeSuccess(res, 200, 'No subscription found', { 
        has_subscription: false,
        company_id: companyId
      });
    }

    writeSuccess(res, 200, 'Subscription retrieved successfully', subscription);
  } catch (err: any) {
    console.error('Error fetching subscription:', err);
    writeError(res, 500, 'Failed to fetch subscription', err.message);
  }
};

/**
 * Update subscription for a company/agency
 */
export const updateEntitySubscription = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { plan, status, trial_days } = req.body;
    const user = (req as any).user;

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
    const getPlanAmount = (planName: string): number => {
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
      const updateData: any = {
        updated_at: new Date()
      };
      
      if (plan) {
        updateData.plan = plan;
        updateData.amount = getPlanAmount(plan);
      }
      if (status) updateData.status = status;
      if (trial_days) {
        updateData.trial_end_date = new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000);
      }

      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: updateData
      });
    } else {
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
  } catch (err: any) {
    console.error('Error updating subscription:', err);
    writeError(res, 500, 'Failed to update subscription', err.message);
  }
};

/**
 * Get subscription history for an entity
 */
export const getEntitySubscriptionHistory = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    console.log(`📜 Fetching subscription history for ${entityType} ${entityId}`);

    // Get company_id based on entity type
    let companyId = entityId;
    
    if (entityType === 'user') {
      const user = await prisma.user.findUnique({ where: { id: entityId } });
      if (!user || !user.company_id) {
        return writeError(res, 404, 'User or company not found');
      }
      companyId = user.company_id;
    } else if (entityType === 'agency') {
      const agency = await prisma.agency.findUnique({ 
        where: { id: entityId },
        select: { company_id: true }
      });
      if (!agency || !agency.company_id) {
        return writeError(res, 404, 'Agency not found or has no associated company');
      }
      companyId = agency.company_id; // Use the agency's company_id
    }

    // Get all subscriptions for this company
    const subscriptions = await prisma.subscription.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        plan: true,
        status: true,
        amount: true,
        start_date: true,
        end_date: true,
        created_at: true,
      },
    });

    writeSuccess(res, 200, 'Subscription history retrieved successfully', {
      history: subscriptions,
    });
  } catch (err: any) {
    console.error('Error fetching subscription history:', err);
    writeError(res, 500, 'Failed to fetch subscription history', err.message);
  }
};

/**
 * Get billing invoices for an entity's subscription
 */
export const getEntitySubscriptionInvoices = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const subscriptionId = req.query.subscription_id as string;

    console.log(`🧾 Fetching invoices for ${entityType} ${entityId}`);

    // Get company_id based on entity type
    let companyId = entityId;
    
    if (entityType === 'user') {
      const user = await prisma.user.findUnique({ where: { id: entityId } });
      if (!user || !user.company_id) {
        return writeError(res, 404, 'User or company not found');
      }
      companyId = user.company_id;
    } else if (entityType === 'agency') {
      const agency = await prisma.agency.findUnique({ where: { id: entityId } });
      if (!agency) {
        return writeError(res, 404, 'Agency not found');
      }
      companyId = entityId;
    }

    // Build where clause
    const where: any = { company_id: companyId };
    if (subscriptionId) {
      where.subscription_id = subscriptionId;
    }

    // Get invoices
    const invoices = await prisma.billingInvoice.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        invoice_number: true,
        amount: true,
        currency: true,
        status: true,
        billing_period_start: true,
        billing_period_end: true,
        due_date: true,
        paid_at: true,
        gateway_reference: true,
        created_at: true,
      },
    });

    writeSuccess(res, 200, 'Invoices retrieved successfully', {
      invoices,
    });
  } catch (err: any) {
    console.error('Error fetching invoices:', err);
    writeError(res, 500, 'Failed to fetch invoices', err.message);
  }
};

/**
 * Get all payment gateways
 */
export const getPaymentGateways = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user || !user.user_id) {
      return writeError(res, 401, 'Authentication required');
    }
    
    let gateways = await prisma.paymentGatewayConfig.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        gateway: true,
        status: true,
        transaction_fee: true,
        currency: true,
        description: true,
        logo: true,
        supported_countries: true,
        features: true,
        is_test_mode: true,
        monthly_transactions: true,
        monthly_volume: true,
        success_rate: true,
        created_at: true,
        updated_at: true,
      },
    });

    // If no gateways exist, seed default ones
    if (gateways.length === 0) {
      console.log('No payment gateways found, seeding default gateways...');
      
      const defaultGateways = [
        {
          name: 'M-Pesa',
          type: 'mobile_money',
          provider: 'Safaricom',
          gateway: 'mpesa' as const,
          status: 'active',
          transaction_fee: 2.5,
          currency: 'KES',
          description: 'Kenya\'s leading mobile money service',
          logo: '📱',
          supported_countries: ['Kenya'],
          features: ['Instant payments', 'Mobile verification', 'SMS notifications'],
          is_test_mode: false,
        },
        {
          name: 'Paystack',
          type: 'card',
          provider: 'Paystack',
          gateway: 'paystack' as const,
          status: 'active',
          transaction_fee: 3.0,
          currency: 'KES',
          description: 'Cards, Mobile Money, Bank Transfers (via Paystack)',
          logo: '💳',
          supported_countries: ['Kenya', 'Nigeria', 'Ghana', 'South Africa'],
          features: ['3D Secure', 'Fraud protection', 'Recurring payments', 'Multi-channel'],
          is_test_mode: true,
        },
        {
          name: 'Stripe',
          type: 'card',
          provider: 'Stripe',
          gateway: 'stripe' as const,
          status: 'active',
          transaction_fee: 3.2,
          currency: 'KES',
          description: 'International credit and debit cards',
          logo: '💳',
          supported_countries: ['Global'],
          features: ['3D Secure', 'Fraud protection', 'Recurring payments', 'International'],
          is_test_mode: true,
        },
        {
          name: 'Flutterwave',
          type: 'card',
          provider: 'Flutterwave',
          gateway: 'flutterwave' as const,
          status: 'inactive',
          transaction_fee: 2.9,
          currency: 'KES',
          description: 'Pan-African payment gateway',
          logo: '🌍',
          supported_countries: ['Kenya', 'Nigeria', 'Ghana', 'South Africa', 'Tanzania', 'Uganda'],
          features: ['Multi-currency', 'Mobile money', 'Bank transfers', 'Cards'],
          is_test_mode: true,
        },
      ];

      // Create default gateways
      const createdGateways = await Promise.all(
        defaultGateways.map(gateway =>
          prisma.paymentGatewayConfig.create({
            data: {
              ...gateway,
              created_by: user.user_id,
            },
            select: {
              id: true,
              name: true,
              type: true,
              provider: true,
              gateway: true,
              status: true,
              transaction_fee: true,
              currency: true,
              description: true,
              logo: true,
              supported_countries: true,
              features: true,
              is_test_mode: true,
              monthly_transactions: true,
              monthly_volume: true,
              success_rate: true,
              created_at: true,
              updated_at: true,
            },
          })
        )
      );

      gateways = createdGateways;
      console.log(`✅ Seeded ${createdGateways.length} default payment gateways`);
    }

    // Calculate statistics
    const activeGateways = gateways.filter((g: any) => g.status === 'active').length;
    const totalTransactions = gateways.reduce((sum: number, g: any) => sum + g.monthly_transactions, 0);
    const totalVolume = gateways.reduce((sum: number, g: any) => sum + Number(g.monthly_volume), 0);
    const activeGatewaysList = gateways.filter((g: any) => g.status === 'active');
    const averageSuccessRate = activeGatewaysList.length > 0
      ? activeGatewaysList.reduce((sum: number, g: any) => sum + Number(g.success_rate), 0) / activeGatewaysList.length
      : 0;

    writeSuccess(res, 200, 'Payment gateways retrieved successfully', {
      gateways,
      statistics: {
        activeGateways,
        totalTransactions,
        totalVolume,
        averageSuccessRate: Number(averageSuccessRate.toFixed(2)),
      },
    });
  } catch (err: any) {
    console.error('Error fetching payment gateways:', err);
    writeError(res, 500, 'Failed to fetch payment gateways', err.message);
  }
};

/**
 * Get a single payment gateway by ID
 */
export const getPaymentGateway = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const gateway = await prisma.paymentGatewayConfig.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        gateway: true,
        status: true,
        transaction_fee: true,
        currency: true,
        description: true,
        logo: true,
        supported_countries: true,
        features: true,
        webhook_url: true,
        is_test_mode: true,
        monthly_transactions: true,
        monthly_volume: true,
        success_rate: true,
        metadata: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!gateway) {
      return writeError(res, 404, 'Payment gateway not found');
    }

    writeSuccess(res, 200, 'Payment gateway retrieved successfully', gateway);
  } catch (err: any) {
    console.error('Error fetching payment gateway:', err);
    writeError(res, 500, 'Failed to fetch payment gateway', err.message);
  }
};

/**
 * Create a new payment gateway
 */
export const createPaymentGateway = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      name,
      type,
      provider,
      gateway,
      transaction_fee,
      currency,
      description,
      logo,
      supported_countries,
      features,
      api_credentials,
      webhook_url,
      is_test_mode,
    } = req.body;

    // Validate required fields
    if (!name || !type || !provider || !gateway) {
      return writeError(res, 400, 'Name, type, provider, and gateway are required');
    }

    const newGateway = await prisma.paymentGatewayConfig.create({
      data: {
        name,
        type,
        provider,
        gateway,
        transaction_fee: transaction_fee || 0,
        currency: currency || 'KES',
        description,
        logo,
        supported_countries: supported_countries || [],
        features: features || [],
        api_credentials: api_credentials || {},
        webhook_url,
        is_test_mode: is_test_mode !== undefined ? is_test_mode : true,
        status: 'inactive',
        created_by: user.id,
      },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        gateway: true,
        status: true,
        transaction_fee: true,
        currency: true,
        description: true,
        logo: true,
        supported_countries: true,
        features: true,
        is_test_mode: true,
        created_at: true,
        updated_at: true,
      },
    });

    writeSuccess(res, 201, 'Payment gateway created successfully', newGateway);
  } catch (err: any) {
    console.error('Error creating payment gateway:', err);
    writeError(res, 500, 'Failed to create payment gateway', err.message);
  }
};

/**
 * Update a payment gateway
 */
export const updatePaymentGateway = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      provider,
      gateway,
      transaction_fee,
      currency,
      description,
      logo,
      supported_countries,
      features,
      api_credentials,
      webhook_url,
      is_test_mode,
    } = req.body;

    // Check if gateway exists
    const existingGateway = await prisma.paymentGatewayConfig.findUnique({
      where: { id },
    });

    if (!existingGateway) {
      return writeError(res, 404, 'Payment gateway not found');
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (provider !== undefined) updateData.provider = provider;
    if (gateway !== undefined) updateData.gateway = gateway;
    if (transaction_fee !== undefined) updateData.transaction_fee = transaction_fee;
    if (currency !== undefined) updateData.currency = currency;
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;
    if (supported_countries !== undefined) updateData.supported_countries = supported_countries;
    if (features !== undefined) updateData.features = features;
    if (api_credentials !== undefined) updateData.api_credentials = api_credentials;
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
    if (is_test_mode !== undefined) updateData.is_test_mode = is_test_mode;
    updateData.updated_at = new Date();

    const updatedGateway = await prisma.paymentGatewayConfig.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        gateway: true,
        status: true,
        transaction_fee: true,
        currency: true,
        description: true,
        logo: true,
        supported_countries: true,
        features: true,
        is_test_mode: true,
        created_at: true,
        updated_at: true,
      },
    });

    writeSuccess(res, 200, 'Payment gateway updated successfully', updatedGateway);
  } catch (err: any) {
    console.error('Error updating payment gateway:', err);
    writeError(res, 500, 'Failed to update payment gateway', err.message);
  }
};

/**
 * Toggle payment gateway status
 */
export const togglePaymentGatewayStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const gateway = await prisma.paymentGatewayConfig.findUnique({
      where: { id },
    });

    if (!gateway) {
      return writeError(res, 404, 'Payment gateway not found');
    }

    const newStatus = gateway.status === 'active' ? 'inactive' : 'active';

    const updatedGateway = await prisma.paymentGatewayConfig.update({
      where: { id },
      data: {
        status: newStatus,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        gateway: true,
        status: true,
        transaction_fee: true,
        currency: true,
        description: true,
        logo: true,
        supported_countries: true,
        features: true,
        is_test_mode: true,
        monthly_transactions: true,
        monthly_volume: true,
        success_rate: true,
        created_at: true,
        updated_at: true,
      },
    });

    writeSuccess(res, 200, `Payment gateway ${newStatus} successfully`, updatedGateway);
  } catch (err: any) {
    console.error('Error toggling payment gateway status:', err);
    writeError(res, 500, 'Failed to toggle payment gateway status', err.message);
  }
};
