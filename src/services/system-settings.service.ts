import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

export interface SystemSettingData {
  key: string;
  value: string;
  data_type?: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description?: string;
  is_public?: boolean;
}

export class SystemSettingsService {
  private prisma = getPrisma();

  /**
   * Get all system settings, optionally filtered by category
   */
  async getSystemSettings(category?: string) {
    try {
      const where = category ? { category } : {};
      
      const settings = await this.prisma.systemSettings.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { key: 'asc' }
        ],
        include: {
          updater: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });

      return settings.map(setting => ({
        id: setting.id,
        key: setting.key,
        value: setting.value,
        data_type: setting.data_type as 'string' | 'number' | 'boolean' | 'json',
        category: setting.category,
        description: setting.description || '',
        is_public: setting.is_public,
        updated_by: setting.updated_by || '',
        updated_at: setting.updated_at.toISOString(),
        name: this.getSettingName(setting.key),
        type: setting.data_type
      }));
    } catch (error: any) {
      console.error('Error fetching system settings:', error);
      throw new Error('Failed to fetch system settings');
    }
  }

  /**
   * Get a single system setting by key
   */
  async getSystemSetting(key: string) {
    try {
      const setting = await this.prisma.systemSettings.findUnique({
        where: { key },
        include: {
          updater: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });

      if (!setting) {
        return null;
      }

      return {
        id: setting.id,
        key: setting.key,
        value: setting.value,
        data_type: setting.data_type as 'string' | 'number' | 'boolean' | 'json',
        category: setting.category,
        description: setting.description || '',
        is_public: setting.is_public,
        updated_by: setting.updated_by || '',
        updated_at: setting.updated_at.toISOString(),
        name: this.getSettingName(setting.key),
        type: setting.data_type
      };
    } catch (error: any) {
      console.error('Error fetching system setting:', error);
      throw new Error('Failed to fetch system setting');
    }
  }

  /**
   * Create or update a system setting
   */
  async upsertSystemSetting(user: JWTClaims, data: SystemSettingData) {
    try {
      // Validate value based on data type
      const validatedValue = this.validateValue(data.value, data.data_type || 'string');

      const setting = await this.prisma.systemSettings.upsert({
        where: { key: data.key },
        update: {
          value: validatedValue,
          data_type: data.data_type || 'string',
          category: data.category,
          description: data.description,
          is_public: data.is_public ?? false,
          updated_by: user.user_id,
          updated_at: new Date()
        },
        create: {
          key: data.key,
          value: validatedValue,
          data_type: data.data_type || 'string',
          category: data.category,
          description: data.description,
          is_public: data.is_public ?? false,
          updated_by: user.user_id
        }
      });

      return {
        id: setting.id,
        key: setting.key,
        value: setting.value,
        data_type: setting.data_type as 'string' | 'number' | 'boolean' | 'json',
        category: setting.category,
        description: setting.description || '',
        is_public: setting.is_public,
        updated_by: setting.updated_by || '',
        updated_at: setting.updated_at.toISOString()
      };
    } catch (error: any) {
      console.error('Error upserting system setting:', error);
      throw new Error(`Failed to save system setting: ${error.message}`);
    }
  }

  /**
   * Update a system setting by key
   */
  async updateSystemSetting(user: JWTClaims, key: string, value: string) {
    try {
      const existing = await this.prisma.systemSettings.findUnique({
        where: { key }
      });

      if (!existing) {
        throw new Error(`System setting with key '${key}' not found`);
      }

      // Validate value based on existing data type
      const validatedValue = this.validateValue(value, existing.data_type as 'string' | 'number' | 'boolean' | 'json');

      const setting = await this.prisma.systemSettings.update({
        where: { key },
        data: {
          value: validatedValue,
          updated_by: user.user_id,
          updated_at: new Date()
        }
      });

      return {
        id: setting.id,
        key: setting.key,
        value: setting.value,
        data_type: setting.data_type as 'string' | 'number' | 'boolean' | 'json',
        category: setting.category,
        description: setting.description || '',
        is_public: setting.is_public,
        updated_by: setting.updated_by || '',
        updated_at: setting.updated_at.toISOString()
      };
    } catch (error: any) {
      console.error('Error updating system setting:', error);
      throw new Error(`Failed to update system setting: ${error.message}`);
    }
  }

  /**
   * Bulk update system settings
   */
  async bulkUpdateSystemSettings(user: JWTClaims, settings: Record<string, string>) {
    try {
      const updates = await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          this.updateSystemSetting(user, key, value)
        )
      );

      return updates;
    } catch (error: any) {
      console.error('Error bulk updating system settings:', error);
      throw new Error(`Failed to bulk update system settings: ${error.message}`);
    }
  }

  /**
   * Initialize default system settings if they don't exist
   */
  async initializeDefaultSettings(user: JWTClaims) {
    // Check if any settings already exist
    const existingCount = await this.prisma.systemSettings.count();
    if (existingCount > 0) {
      console.log(`System settings already initialized (${existingCount} settings found)`);
      return;
    }

    console.log('Initializing default system settings...');
    const defaultSettings: SystemSettingData[] = [
      {
        key: 'site_name',
        value: 'LetRents Property Management',
        data_type: 'string',
        category: 'general',
        description: 'The name of the application',
        is_public: true
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        data_type: 'boolean',
        category: 'general',
        description: 'Enable maintenance mode to restrict access',
        is_public: false
      },
      {
        key: 'smtp_host',
        value: 'smtp.gmail.com',
        data_type: 'string',
        category: 'email',
        description: 'SMTP server host for sending emails',
        is_public: false
      },
      {
        key: 'smtp_port',
        value: '587',
        data_type: 'number',
        category: 'email',
        description: 'SMTP server port',
        is_public: false
      },
      {
        key: 'smtp_username',
        value: '',
        data_type: 'string',
        category: 'email',
        description: 'SMTP username',
        is_public: false
      },
      {
        key: 'smtp_password',
        value: '',
        data_type: 'string',
        category: 'email',
        description: 'SMTP password (encrypted)',
        is_public: false
      },
      {
        key: 'smtp_from_email',
        value: 'noreply@letrents.com',
        data_type: 'string',
        category: 'email',
        description: 'Default sender email address',
        is_public: false
      },
      {
        key: 'smtp_from_name',
        value: 'LetRents',
        data_type: 'string',
        category: 'email',
        description: 'Default sender name',
        is_public: false
      },
      {
        key: 'payment_gateway_enabled',
        value: 'true',
        data_type: 'boolean',
        category: 'payment',
        description: 'Enable payment gateway integration',
        is_public: false
      },
      {
        key: 'mpesa_enabled',
        value: 'true',
        data_type: 'boolean',
        category: 'payment',
        description: 'Enable M-Pesa payment integration',
        is_public: false
      },
      {
        key: 'storage_provider',
        value: 'local',
        data_type: 'string',
        category: 'storage',
        description: 'Storage provider (local, s3, cloudinary)',
        is_public: false
      },
      {
        key: 'max_file_size',
        value: '10485760',
        data_type: 'number',
        category: 'storage',
        description: 'Maximum file upload size in bytes (10MB default)',
        is_public: false
      },
      {
        key: 'api_rate_limit',
        value: '100',
        data_type: 'number',
        category: 'api',
        description: 'API rate limit per minute',
        is_public: false
      },
      {
        key: 'enable_two_factor',
        value: 'false',
        data_type: 'boolean',
        category: 'security',
        description: 'Enable two-factor authentication',
        is_public: false
      },
      {
        key: 'session_timeout',
        value: '3600',
        data_type: 'number',
        category: 'security',
        description: 'Session timeout in seconds',
        is_public: false
      },
      {
        key: 'enable_registration',
        value: 'true',
        data_type: 'boolean',
        category: 'feature_flags',
        description: 'Allow new user registrations',
        is_public: true
      },
      {
        key: 'enable_tenant_portal',
        value: 'true',
        data_type: 'boolean',
        category: 'feature_flags',
        description: 'Enable tenant portal access',
        is_public: true
      }
    ];

    try {
      for (const setting of defaultSettings) {
        await this.upsertSystemSetting(user, setting);
      }
    } catch (error: any) {
      console.error('Error initializing default settings:', error);
      // Don't throw, just log - settings might already exist
    }
  }

  /**
   * Validate value based on data type
   */
  private validateValue(value: string, dataType: 'string' | 'number' | 'boolean' | 'json'): string {
    switch (dataType) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return value;
      case 'boolean':
        const lowerValue = value.toLowerCase();
        if (lowerValue !== 'true' && lowerValue !== 'false' && lowerValue !== '1' && lowerValue !== '0') {
          throw new Error(`Invalid boolean value: ${value}`);
        }
        return lowerValue === 'true' || lowerValue === '1' ? 'true' : 'false';
      case 'json':
        try {
          JSON.parse(value);
          return value;
        } catch {
          throw new Error(`Invalid JSON value: ${value}`);
        }
      default:
        return value;
    }
  }

  /**
   * Get human-readable name for setting key
   */
  private getSettingName(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

