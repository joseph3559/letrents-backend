/**
 * Get filtering options based on user role and claims
 */
export function getRoleBasedFilters(user) {
    const filters = {};
    switch (user.role) {
        case 'super_admin':
            // Super admin can see everything - no filters
            break;
        case 'agency_admin':
            // Agency admin can see their agency's data
            if (user.agency_id) {
                filters.agencyId = user.agency_id;
            }
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
            break;
        case 'landlord':
            // Landlord can see their own properties and tenants
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
            filters.landlordId = user.user_id;
            break;
        case 'agent':
            // Agent can see properties assigned to them
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
            if (user.agency_id) {
                filters.agencyId = user.agency_id;
            }
            if (user.landlord_id) {
                filters.landlordId = user.landlord_id;
            }
            break;
        case 'caretaker':
            // Caretaker can see properties they manage
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
            filters.userId = user.user_id;
            break;
        case 'tenant':
            // Tenant can only see their own data
            filters.userId = user.user_id;
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
            break;
        default:
            // Default to user's own data only
            filters.userId = user.user_id;
            if (user.company_id) {
                filters.companyId = user.company_id;
            }
    }
    return filters;
}
/**
 * Build Prisma where clause based on role filters
 */
export function buildWhereClause(user, additionalFilters = {}, modelType = 'property') {
    const roleFilters = getRoleBasedFilters(user);
    const whereClause = { ...additionalFilters };
    // Apply company scoping (most important for multi-tenancy)
    if (roleFilters.companyId) {
        whereClause.company_id = roleFilters.companyId;
    }
    // Apply agency scoping
    // ⚠️ IMPORTANT: Many models don't have agency_id field
    // Only apply agency_id filter for models that actually have this field
    // Models WITHOUT agency_id: user, maintenance, lease, payment, invoice, unit, tenant_profile
    // Models WITH agency_id: property (in some cases), company
    const modelsWithoutAgencyId = ['user', 'maintenance', 'lease', 'payment', 'invoice', 'unit', 'tenant_profile'];
    if (roleFilters.agencyId && !modelsWithoutAgencyId.includes(modelType)) {
        whereClause.agency_id = roleFilters.agencyId;
    }
    // Apply landlord scoping (field name depends on model type)
    if (roleFilters.landlordId) {
        if (modelType === 'user') {
            // For user queries, check the role being queried
            // Landlords should see tenants where landlord_id = current user's ID
            // But for caretakers/agents/staff, only filter by company_id (already applied above)
            if (user.role === 'landlord') {
                // Only apply landlord_id filter if querying tenants
                // Don't apply it for caretakers, agents, or other staff
                if (additionalFilters.role === 'tenant') {
                    whereClause.landlord_id = user.user_id;
                }
                // For non-tenant users (caretakers, agents), company_id filter is sufficient
            }
            else {
                whereClause.landlord_id = roleFilters.landlordId;
            }
        }
        else if (modelType === 'property') {
            whereClause.owner_id = roleFilters.landlordId;
        }
        else if (modelType === 'payment') {
            // For payments, landlords should see payments for their tenants' properties
            whereClause.property = {
                owner_id: roleFilters.landlordId
            };
        }
        else if (modelType === 'mpesa') {
            // For M-Pesa transactions, landlords should see transactions for their properties
            whereClause.property = {
                owner_id: roleFilters.landlordId
            };
        }
    }
    // Apply user scoping (for personal data)
    if (roleFilters.userId && user.role === 'tenant') {
        if (modelType === 'user') {
            whereClause.id = roleFilters.userId;
        }
        else if (modelType === 'payment') {
            whereClause.tenant_id = roleFilters.userId;
        }
        else {
            whereClause.user_id = roleFilters.userId;
        }
    }
    return whereClause;
}
/**
 * Check if user can access specific resource
 */
export function canAccessResource(user, resourceOwnerId, resourceCompanyId) {
    switch (user.role) {
        case 'super_admin':
            return true;
        case 'agency_admin':
            // Can access if same company or agency
            return user.company_id === resourceCompanyId;
        case 'landlord':
            // Can access if they own it or same company
            return user.user_id === resourceOwnerId || user.company_id === resourceCompanyId;
        case 'agent':
            // Can access if assigned or same company/agency
            return user.company_id === resourceCompanyId;
        case 'caretaker':
            // Can access if they manage it or same company
            return user.company_id === resourceCompanyId;
        case 'tenant':
            // Can only access their own data
            return user.user_id === resourceOwnerId;
        default:
            return false;
    }
}
/**
 * Get dashboard data scope based on user role
 */
export function getDashboardScope(user) {
    switch (user.role) {
        case 'super_admin':
            return 'global';
        case 'agency_admin':
            return 'agency';
        case 'landlord':
        case 'agent':
        case 'caretaker':
            return 'company';
        case 'tenant':
            return 'personal';
        default:
            return 'personal';
    }
}
/**
 * Format data based on user role (hide sensitive info for lower roles)
 */
export function formatDataForRole(user, data) {
    // Super admin and agency admin can see everything
    if (user.role === 'super_admin' || user.role === 'agency_admin') {
        return data;
    }
    // For other roles, we might want to hide certain sensitive fields
    if (Array.isArray(data)) {
        return data.map(item => formatSingleItemForRole(user, item));
    }
    return formatSingleItemForRole(user, data);
}
function formatSingleItemForRole(user, item) {
    if (!item || typeof item !== 'object') {
        return item;
    }
    const formatted = { ...item };
    // Hide sensitive financial data from tenants and caretakers
    if (user.role === 'tenant' || user.role === 'caretaker') {
        delete formatted.monthlyRevenue;
        delete formatted.totalRevenue;
        delete formatted.profitMargin;
        delete formatted.expenses;
    }
    // Hide personal info from agents (unless it's their own data)
    if (user.role === 'agent' && formatted.userId !== user.user_id) {
        delete formatted.phoneNumber;
        delete formatted.email;
        delete formatted.address;
    }
    return formatted;
}
