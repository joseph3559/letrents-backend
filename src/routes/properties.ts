import { Router } from 'express';
import { 
  createProperty, 
  getProperty, 
  updateProperty, 
  deleteProperty, 
  listProperties,
  getPropertyAnalytics,
  getPropertyUnits,
  duplicateProperty,
  updatePropertyStatus,
  archiveProperty
} from '../controllers/properties.controller.js';
import { 
  uploadPropertyImages, 
  deletePropertyImage, 
  uploadMiddleware 
} from '../controllers/images.controller.js';
import { 
  uploadPropertyDocuments, 
  getPropertyDocuments,
  documentUploadMiddleware 
} from '../controllers/documents.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Properties CRUD
router.post('/', rbacResource('properties', 'create'), createProperty);
router.get('/', rbacResource('properties', 'read'), listProperties);
router.get('/:id', rbacResource('properties', 'read'), getProperty);
router.put('/:id', rbacResource('properties', 'update'), updateProperty);
router.delete('/:id', rbacResource('properties', 'delete'), deleteProperty);

// Property analytics and units
router.get('/:id/analytics', rbacResource('properties', 'read'), getPropertyAnalytics);
router.get('/:id/units', rbacResource('properties', 'read'), getPropertyUnits);

// Property images
router.post('/:id/images', rbacResource('properties', 'update'), uploadMiddleware, uploadPropertyImages);
router.delete('/:id/images/:imageId', rbacResource('properties', 'update'), deletePropertyImage);

// Property documents
router.post('/:id/documents', rbacResource('properties', 'update'), documentUploadMiddleware, uploadPropertyDocuments);
router.get('/:id/documents', rbacResource('properties', 'read'), getPropertyDocuments);

// Property management actions
router.post('/:id/duplicate', rbacResource('properties', 'duplicate'), duplicateProperty);
router.patch('/:id/status', rbacResource('properties', 'update'), updatePropertyStatus);
router.patch('/:id/archive', rbacResource('properties', 'archive'), archiveProperty);

export default router;
