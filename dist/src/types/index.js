// ============================================================================
// LetRents Property Management System - Professional TypeScript Types
// ============================================================================
// Clean, professional type definitions based on Go backend domain models
// ============================================================================
// ENUMS
// ============================================================================
export var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "super_admin";
    UserRole["AGENCY_ADMIN"] = "agency_admin";
    UserRole["LANDLORD"] = "landlord";
    UserRole["AGENT"] = "agent";
    UserRole["CARETAKER"] = "caretaker";
    UserRole["TENANT"] = "tenant";
})(UserRole || (UserRole = {}));
export var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["PENDING"] = "pending";
})(UserStatus || (UserStatus = {}));
export var PropertyType;
(function (PropertyType) {
    PropertyType["RESIDENTIAL"] = "residential";
    PropertyType["COMMERCIAL"] = "commercial";
    PropertyType["INDUSTRIAL"] = "industrial";
    PropertyType["MIXED_USE"] = "mixed_use";
    PropertyType["INSTITUTIONAL"] = "institutional";
    PropertyType["VACANT_LAND"] = "vacant_land";
    PropertyType["HOSPITALITY"] = "hospitality";
    PropertyType["RECREATIONAL"] = "recreational";
})(PropertyType || (PropertyType = {}));
export var PropertyStatus;
(function (PropertyStatus) {
    PropertyStatus["ACTIVE"] = "active";
    PropertyStatus["UNDER_CONSTRUCTION"] = "under_construction";
    PropertyStatus["RENOVATION"] = "renovation";
    PropertyStatus["INACTIVE"] = "inactive";
})(PropertyStatus || (PropertyStatus = {}));
export var OwnershipType;
(function (OwnershipType) {
    OwnershipType["INDIVIDUAL"] = "individual";
    OwnershipType["COMPANY"] = "company";
    OwnershipType["JOINT"] = "joint";
})(OwnershipType || (OwnershipType = {}));
export var UnitType;
(function (UnitType) {
    UnitType["SINGLE_ROOM"] = "single_room";
    UnitType["DOUBLE_ROOM"] = "double_room";
    UnitType["BEDSITTER"] = "bedsitter";
    UnitType["STUDIO"] = "studio";
    UnitType["ONE_BEDROOM"] = "one_bedroom";
    UnitType["TWO_BEDROOM"] = "two_bedroom";
    UnitType["THREE_BEDROOM"] = "three_bedroom";
    UnitType["FOUR_BEDROOM"] = "four_bedroom";
    UnitType["FIVE_PLUS_BEDROOM"] = "five_plus_bedroom";
    UnitType["SERVANT_QUARTER"] = "servant_quarter";
    UnitType["MAISONETTE"] = "maisonette";
    UnitType["PENTHOUSE"] = "penthouse";
    UnitType["OFFICE_SPACE"] = "office_space";
    UnitType["RETAIL_SHOP"] = "retail_shop";
    UnitType["KIOSK"] = "kiosk";
    UnitType["STALL"] = "stall";
    UnitType["WAREHOUSE"] = "warehouse";
    UnitType["RESTAURANT_SPACE"] = "restaurant_space";
    UnitType["STUDIO_OFFICE"] = "studio_office";
    UnitType["COWORKING_UNIT"] = "coworking_unit";
    UnitType["MEDICAL_SUITE"] = "medical_suite";
})(UnitType || (UnitType = {}));
export var UnitStatus;
(function (UnitStatus) {
    UnitStatus["VACANT"] = "vacant";
    UnitStatus["OCCUPIED"] = "occupied";
    UnitStatus["RESERVED"] = "reserved";
    UnitStatus["MAINTENANCE"] = "maintenance";
    UnitStatus["UNDER_REPAIR"] = "under_repair";
    UnitStatus["ARREARS"] = "arrears";
})(UnitStatus || (UnitStatus = {}));
export var UnitCondition;
(function (UnitCondition) {
    UnitCondition["NEW"] = "new";
    UnitCondition["EXCELLENT"] = "excellent";
    UnitCondition["GOOD"] = "good";
    UnitCondition["FAIR"] = "fair";
    UnitCondition["POOR"] = "poor";
    UnitCondition["NEEDS_REPAIRS"] = "needs_repairs";
    UnitCondition["RENOVATED"] = "renovated";
})(UnitCondition || (UnitCondition = {}));
export var FurnishingType;
(function (FurnishingType) {
    FurnishingType["FURNISHED"] = "furnished";
    FurnishingType["UNFURNISHED"] = "unfurnished";
    FurnishingType["SEMI_FURNISHED"] = "semi_furnished";
})(FurnishingType || (FurnishingType = {}));
export var UtilityBillingType;
(function (UtilityBillingType) {
    UtilityBillingType["PREPAID"] = "prepaid";
    UtilityBillingType["POSTPAID"] = "postpaid";
    UtilityBillingType["INCLUSIVE"] = "inclusive";
})(UtilityBillingType || (UtilityBillingType = {}));
export var MaintenanceStatus;
(function (MaintenanceStatus) {
    MaintenanceStatus["PENDING"] = "pending";
    MaintenanceStatus["IN_PROGRESS"] = "in_progress";
    MaintenanceStatus["COMPLETED"] = "completed";
    MaintenanceStatus["CANCELLED"] = "cancelled";
})(MaintenanceStatus || (MaintenanceStatus = {}));
export var PriorityLevel;
(function (PriorityLevel) {
    PriorityLevel["LOW"] = "low";
    PriorityLevel["MEDIUM"] = "medium";
    PriorityLevel["HIGH"] = "high";
    PriorityLevel["URGENT"] = "urgent";
})(PriorityLevel || (PriorityLevel = {}));
export var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "draft";
    InvoiceStatus["SENT"] = "sent";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["CANCELLED"] = "cancelled";
})(InvoiceStatus || (InvoiceStatus = {}));
export var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["UNREAD"] = "unread";
    NotificationStatus["READ"] = "read";
    NotificationStatus["ARCHIVED"] = "archived";
})(NotificationStatus || (NotificationStatus = {}));
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["DRAFT"] = "draft";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (MessageStatus = {}));
// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================
export const PERMISSIONS = {
    // User management
    MANAGE_USERS: 'manage_users',
    VIEW_USERS: 'view_users',
    CREATE_USERS: 'create_users',
    UPDATE_USERS: 'update_users',
    DELETE_USERS: 'delete_users',
    // Agency management
    MANAGE_AGENCIES: 'manage_agencies',
    VIEW_AGENCIES: 'view_agencies',
    CREATE_AGENCIES: 'create_agencies',
    UPDATE_AGENCIES: 'update_agencies',
    DELETE_AGENCIES: 'delete_agencies',
    // Property management
    MANAGE_PROPERTIES: 'manage_properties',
    VIEW_PROPERTIES: 'view_properties',
    CREATE_PROPERTIES: 'create_properties',
    UPDATE_PROPERTIES: 'update_properties',
    DELETE_PROPERTIES: 'delete_properties',
    // Unit management
    MANAGE_UNITS: 'manage_units',
    VIEW_UNITS: 'view_units',
    CREATE_UNITS: 'create_units',
    UPDATE_UNITS: 'update_units',
    DELETE_UNITS: 'delete_units',
    // Tenant management
    MANAGE_TENANTS: 'manage_tenants',
    VIEW_TENANTS: 'view_tenants',
    CREATE_TENANTS: 'create_tenants',
    UPDATE_TENANTS: 'update_tenants',
    DELETE_TENANTS: 'delete_tenants',
    // Maintenance management
    MANAGE_MAINTENANCE: 'manage_maintenance',
    VIEW_MAINTENANCE: 'view_maintenance',
    CREATE_MAINTENANCE: 'create_maintenance',
    UPDATE_MAINTENANCE: 'update_maintenance',
    // Invoice management
    MANAGE_INVOICES: 'manage_invoices',
    VIEW_INVOICES: 'view_invoices',
    CREATE_INVOICES: 'create_invoices',
    UPDATE_INVOICES: 'update_invoices',
    // Communication
    MANAGE_COMMUNICATIONS: 'manage_communications',
    VIEW_COMMUNICATIONS: 'view_communications',
    SEND_MESSAGES: 'send_messages',
    // Reports and analytics
    VIEW_REPORTS: 'view_reports',
    VIEW_ANALYTICS: 'view_analytics',
    VIEW_DASHBOARD: 'view_dashboard'
};
