// ============================================================================
// LetRents Property Management System - Professional TypeScript Types
// ============================================================================
// Clean, professional type definitions based on Go backend domain models

import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  AGENCY_ADMIN = 'agency_admin',
  LANDLORD = 'landlord',
  AGENT = 'agent',
  CARETAKER = 'caretaker',
  TENANT = 'tenant'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export enum PropertyType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  MIXED_USE = 'mixed_use',
  INSTITUTIONAL = 'institutional',
  VACANT_LAND = 'vacant_land',
  HOSPITALITY = 'hospitality',
  RECREATIONAL = 'recreational'
}

export enum PropertyStatus {
  ACTIVE = 'active',
  UNDER_CONSTRUCTION = 'under_construction',
  RENOVATION = 'renovation',
  INACTIVE = 'inactive'
}

export enum OwnershipType {
  INDIVIDUAL = 'individual',
  COMPANY = 'company',
  JOINT = 'joint'
}

export enum UnitType {
  SINGLE_ROOM = 'single_room',
  DOUBLE_ROOM = 'double_room',
  BEDSITTER = 'bedsitter',
  STUDIO = 'studio',
  ONE_BEDROOM = 'one_bedroom',
  TWO_BEDROOM = 'two_bedroom',
  THREE_BEDROOM = 'three_bedroom',
  FOUR_BEDROOM = 'four_bedroom',
  FIVE_PLUS_BEDROOM = 'five_plus_bedroom',
  SERVANT_QUARTER = 'servant_quarter',
  MAISONETTE = 'maisonette',
  PENTHOUSE = 'penthouse',
  OFFICE_SPACE = 'office_space',
  RETAIL_SHOP = 'retail_shop',
  KIOSK = 'kiosk',
  STALL = 'stall',
  WAREHOUSE = 'warehouse',
  RESTAURANT_SPACE = 'restaurant_space',
  STUDIO_OFFICE = 'studio_office',
  COWORKING_UNIT = 'coworking_unit',
  MEDICAL_SUITE = 'medical_suite'
}

export enum UnitStatus {
  VACANT = 'vacant',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
  UNDER_REPAIR = 'under_repair',
  ARREARS = 'arrears'
}

export enum UnitCondition {
  NEW = 'new',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  NEEDS_REPAIRS = 'needs_repairs',
  RENOVATED = 'renovated'
}

export enum FurnishingType {
  FURNISHED = 'furnished',
  UNFURNISHED = 'unfurnished',
  SEMI_FURNISHED = 'semi_furnished'
}

export enum UtilityBillingType {
  PREPAID = 'prepaid',
  POSTPAID = 'postpaid',
  INCLUSIVE = 'inclusive'
}

export enum MaintenanceStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum PriorityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived'
}

export enum MessageStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface Company {
  id: string;
  name: string;
  business_type?: string;
  registration_number?: string;
  tax_id?: string;
  email?: string;
  phone_number?: string;
  website?: string;
  street?: string;
  city?: string;
  region?: string;
  country: string;
  postal_code?: string;
  industry?: string;
  company_size?: string;
  status: string;
  subscription_plan: string;
  max_property: number;
  max_units: number;
  max_tenants: number;
  max_staff: number;
  settings: any;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Agency {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
  address?: string;
  status: UserStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  email?: string;
  password_hash?: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: UserRole;
  status: UserStatus;
  company_id?: string;
  agency_id?: string;
  landlord_id?: string;
  email_verified: boolean;
  phone_verified: boolean;
  account_locked_until?: Date;
  failed_login_attempts: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  description?: string;
  street: string;
  city: string;
  region: string;
  country: string;
  postal_code?: string;
  latitude?: Decimal;
  longitude?: Decimal;
  ownership_type: OwnershipType;
  owner_id: string;
  agency_id?: string;
  number_of_units: number;
  number_of_blocks?: number;
  number_of_floors?: number;
  service_charge_rate?: Decimal;
  service_charge_type?: string;
  amenities: any;
  access_control?: string;
  maintenance_schedule?: string;
  status: PropertyStatus;
  year_built?: number;
  last_renovation?: Date;
  documents: any;
  images: any;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: UnitType;
  block_number?: string;
  floor_number?: number;
  size_square_feet?: Decimal;
  size_square_meters?: Decimal;
  number_of_bedrooms?: number;
  number_of_bathrooms?: number;
  has_ensuite: boolean;
  has_balcony: boolean;
  has_parking: boolean;
  parking_spaces: number;
  rent_amount: Decimal;
  currency: string;
  deposit_amount: Decimal;
  deposit_months: number;
  status: UnitStatus;
  condition: UnitCondition;
  furnishing_type: FurnishingType;
  water_meter_number?: string;
  electric_meter_number?: string;
  utility_billing_type: UtilityBillingType;
  in_unit_amenities: any;
  appliances: any;
  current_tenant_id?: string;
  lease_start_date?: Date;
  lease_end_date?: Date;
  lease_type?: string;
  documents: any;
  images: any;
  estimated_value?: Decimal;
  market_rent_estimate?: Decimal;
  last_valuation_date?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface MaintenanceRequest {
  id: string;
  property_id: string;
  unit_id?: string;
  title: string;
  description: string;
  category: string;
  priority: PriorityLevel;
  status: MaintenanceStatus;
  requested_by: string;
  assigned_to?: string;
  requested_date: Date;
  scheduled_date?: Date;
  completed_date?: Date;
  estimated_cost?: Decimal;
  actual_cost?: Decimal;
  images: any;
  documents: any;
  notes?: string;
  internal_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  description?: string;
  invoice_type: string;
  issued_by: string;
  issued_to: string;
  property_id?: string;
  unit_id?: string;
  subtotal: Decimal;
  tax_amount: Decimal;
  discount_amount: Decimal;
  total_amount: Decimal;
  currency: string;
  issue_date: Date;
  due_date: Date;
  paid_date?: Date;
  status: InvoiceStatus;
  payment_method?: string;
  payment_reference?: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  total_price: Decimal;
  metadata: any;
  created_at: Date;
}

export interface Notification {
  id: string;
  sender_id?: string;
  recipient_id: string;
  title: string;
  message: string;
  notification_type: string;
  category?: string;
  priority: PriorityLevel;
  status: NotificationStatus;
  is_read: boolean;
  read_at?: Date;
  action_required: boolean;
  action_url?: string;
  action_data?: any;
  related_entity_type?: string;
  related_entity_id?: string;
  channels: any;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  subject?: string;
  content: string;
  message_type: string;
  priority: PriorityLevel;
  status: MessageStatus;
  sent_at?: Date;
  scheduled_for?: Date;
  parent_message_id?: string;
  thread_id?: string;
  template_id?: string;
  is_ai_generated: boolean;
  ai_confidence?: Decimal;
  attachments: any;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_id: string;
  is_read: boolean;
  read_at?: Date;
  delivered_at?: Date;
  is_starred: boolean;
  is_archived: boolean;
  created_at: Date;
}

export interface TenantProfile {
  id: string;
  user_id: string;
  id_number?: string;
  nationality?: string;
  move_in_date?: Date;
  lease_type?: string;
  lease_start_date?: Date;
  lease_end_date?: Date;
  rent_amount?: Decimal;
  deposit_amount?: Decimal;
  payment_frequency?: string;
  payment_day?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  preferred_communication_method?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// AUTHENTICATION INTERFACES
// ============================================================================

export interface LoginRequest {
  email?: string;
  phone_number?: string;
  password: string;
  method: 'email' | 'phone';
  device_info?: DeviceInfo;
  remember_me?: boolean;
}

export interface RegisterRequest {
  email?: string;
  phone_number?: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  company_id?: string;
  agency_id?: string;
  landlord_id?: string;
  device_info?: DeviceInfo;
  company_name?: string;
  business_type?: string;
  company_email?: string;
  company_phone?: string;
  create_company?: boolean;
}

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  platform: string;
  version: string;
  user_agent: string;
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: User;
  expires_at: Date;
  permissions: string[];
  session_id: string;
  requires_mfa?: boolean;
  mfa_methods?: string[];
}

export interface JWTClaims {
  user_id: string;
  email: string;
  phone_number: string;
  role: UserRole;
  company_id?: string;
  agency_id?: string;
  landlord_id?: string;
  session_id: string;
  permissions: string[];
  iat: number;
  exp: number;
  nbf: number;
  iss: string;
  sub: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  device_info?: DeviceInfo;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  is_revoked: boolean;
  revoked_at?: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  is_used: boolean;
  used_at?: Date;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token_hash: string;
  email: string;
  expires_at: Date;
  created_at: Date;
  is_used: boolean;
  used_at?: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info?: DeviceInfo;
  ip_address?: string;
  user_agent?: string;
  last_activity: Date;
  expires_at: Date;
  created_at: Date;
  is_active: boolean;
}

// ============================================================================
// REQUEST/RESPONSE INTERFACES
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
  };
  errors?: ErrorDetail[];
}

export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  type?: string;
  [key: string]: any;
}

// ============================================================================
// DASHBOARD INTERFACES
// ============================================================================

export interface DashboardStats {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_rate: number;
  total_tenants: number;
  pending_maintenance: number;
  overdue_invoices: number;
  total_revenue: number;
  monthly_revenue: number;
  calculated_at: Date;
}

export interface OnboardingStatus {
  has_property: boolean;
  has_units: boolean;
  has_tenants: boolean;
  has_invoices: boolean;
  completion_percentage: number;
  next_steps: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type CreatePropertyRequest = Omit<Property, 'id' | 'created_at' | 'updated_at'>;
export type UpdatePropertyRequest = Partial<CreatePropertyRequest>;

export type CreateUnitRequest = Omit<Unit, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUnitRequest = Partial<CreateUnitRequest>;

export type CreateMaintenanceRequest = Omit<MaintenanceRequest, 'id' | 'created_at' | 'updated_at'>;
export type UpdateMaintenanceRequest = Partial<CreateMaintenanceRequest>;

export type CreateInvoiceRequest = Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
export type UpdateInvoiceRequest = Partial<CreateInvoiceRequest>;

export type CreateUserRequest = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUserRequest = Partial<CreateUserRequest>;

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
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];