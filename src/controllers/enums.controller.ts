import { Request, Response } from 'express';
import { writeSuccess, writeError } from '../utils/response.js';

export const enumsController = {
  getEnums: async (req: Request, res: Response) => {
    try {
      const enums = {
        unitConditions: [
          'new',
          'excellent', 
          'good',
          'fair',
          'poor',
          'needs_repairs',
          'renovated'
        ],
        unitStatuses: [
          'vacant',
          'occupied', 
          'reserved',
          'maintenance',
          'under_repair',
          'arrears'
        ],
        furnishingTypes: [
          'furnished',
          'unfurnished',
          'semi_furnished'
        ],
        utilityBillingTypes: [
          'prepaid',
          'postpaid',
          'inclusive'
        ],
        unitTypes: [
          'single_room',
          'double_room',
          'bedsitter',
          'studio',
          'one_bedroom',
          'two_bedroom',
          'three_bedroom',
          'four_bedroom',
          'five_plus_bedroom',
          'servant_quarter',
          'maisonette',
          'penthouse',
          'office_space',
          'retail_shop',
          'kiosk',
          'stall',
          'warehouse',
          'restaurant_space',
          'studio_office',
          'coworking_unit',
          'medical_suite'
        ],
        propertyTypes: [
          'apartment',
          'house',
          'commercial',
          'mixed_use',
          'warehouse',
          'office_building',
          'retail_space',
          'industrial'
        ],
        propertyStatuses: [
          'active',
          'inactive',
          'under_construction',
          'maintenance'
        ],
        priorityLevels: [
          'low',
          'medium',
          'high',
          'urgent'
        ],
        maintenanceStatuses: [
          'pending',
          'in_progress',
          'completed',
          'cancelled'
        ],
        leaseTypes: [
          'fixed_term',
          'month_to_month',
          'yearly'
        ],
        leaseStatuses: [
          'draft',
          'active',
          'expired',
          'terminated',
          'renewed'
        ]
      };

      writeSuccess(res, 200, 'Enums retrieved successfully', enums);
    } catch (error: any) {
      console.error('Error getting enums:', error);
      writeError(res, 500, error.message || 'Failed to retrieve enums');
    }
  },

  getUnitConditions: async (req: Request, res: Response) => {
    try {
      const conditions = [
        'new',
        'excellent', 
        'good',
        'fair',
        'poor',
        'needs_repairs',
        'renovated'
      ];

      writeSuccess(res, 200, 'Unit conditions retrieved successfully', conditions);
    } catch (error: any) {
      console.error('Error getting unit conditions:', error);
      writeError(res, 500, error.message || 'Failed to retrieve unit conditions');
    }
  }
};
