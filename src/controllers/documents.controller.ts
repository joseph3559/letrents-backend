import { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { imagekitService } from '../services/imagekit.service.js';
import { TenantsService } from '../services/tenants.service.js';
import { UnitsService } from '../services/units.service.js';
import { UnitActivityService } from '../services/unit-activity.service.js';
import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const tenantsService = new TenantsService();
const unitsService = new UnitsService();
const unitActivityService = new UnitActivityService();
const prisma = getPrisma();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

export const documentUploadMiddleware = upload.array('documents', 10);

const parseTags = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return input.split(',').map(tag => tag.trim()).filter(Boolean);
    }
  }
  return [];
};

export const uploadTenantDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: tenantId } = req.params;
    const { category, description, expiry_date } = req.body;
    const tags = parseTags(req.body.tags);

    if (!tenantId) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await tenantsService.getTenant(tenantId, user);

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return writeError(res, 400, 'No documents provided');
    }

    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const fileName = `tenant-${tenantId}-${Date.now()}-${index}`;
        const uploadResult = await imagekitService.uploadFile(
          file.buffer,
          fileName,
          `tenants/${tenantId}/documents`
        );

        const document = await prisma.tenantDocument.create({
          data: {
            tenant_id: tenantId,
            company_id: user.company_id!,
            name: file.originalname,
            type: file.mimetype,
            category: category || 'other',
            size: file.size,
            url: uploadResult.url,
            description: description || null,
            tags,
            expiry_date: expiry_date ? new Date(expiry_date) : null,
            status: 'pending',
            uploaded_by: user.user_id,
          },
        });

        return {
          id: document.id,
          name: document.name,
          type: document.type,
          category: document.category,
          size: `${(document.size / 1024 / 1024).toFixed(2)} MB`,
          uploadDate: document.created_at.toISOString(),
          url: document.url,
        };
      })
    );

    writeSuccess(res, 200, 'Documents uploaded successfully', uploadedDocuments);
  } catch (error: any) {
    console.error('Error uploading tenant documents:', error);
    const message = error.message || 'Failed to upload documents';
    writeError(res, 500, message);
  }
};

export const uploadUnitDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: unitId } = req.params;
    const { category, description, expiry_date } = req.body;
    const tags = parseTags(req.body.tags);

    if (!unitId) {
      return writeError(res, 400, 'Unit ID is required');
    }

    const unit = await unitsService.getUnit(unitId, user);

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return writeError(res, 400, 'No documents provided');
    }

    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const fileName = `unit-${unitId}-${Date.now()}-${index}`;
        const uploadResult = await imagekitService.uploadFile(
          file.buffer,
          fileName,
          `units/${unitId}/documents`
        );

        return {
          id: randomUUID(),
          name: file.originalname,
          type: file.mimetype,
          category: category || 'other',
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          uploaded_at: new Date().toISOString(),
          url: uploadResult.url,
          description: description || null,
          tags,
          expiry_date: expiry_date || null,
        };
      })
    );

    const currentDocuments = Array.isArray((unit as any).documents)
      ? (unit as any).documents
      : [];

    const updatedDocuments = [...currentDocuments, ...uploadedDocuments];

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        documents: updatedDocuments,
        updated_at: new Date(),
      },
    });

    await unitActivityService.logActivity({
      unit_id: unitId,
      company_id: user.company_id!,
      actor_id: user.user_id,
      event_type: 'document_upload',
      title: 'Documents uploaded',
      description: `${uploadedDocuments.length} document(s) uploaded`,
      metadata: {
        documents: uploadedDocuments.map(doc => ({
          name: doc.name,
          category: doc.category,
          url: doc.url,
        })),
      },
    });

    writeSuccess(res, 200, 'Documents uploaded successfully', uploadedDocuments);
  } catch (error: any) {
    console.error('Error uploading unit documents:', error);
    const message = error.message || 'Failed to upload documents';
    writeError(res, 500, message);
  }
};

export const getUnitDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: unitId } = req.params;

    if (!unitId) {
      return writeError(res, 400, 'Unit ID is required');
    }

    const unit = await unitsService.getUnit(unitId, user);
    const documents = Array.isArray((unit as any).documents)
      ? (unit as any).documents
      : [];

    writeSuccess(res, 200, 'Unit documents retrieved successfully', documents);
  } catch (error: any) {
    console.error('Error fetching unit documents:', error);
    const message = error.message || 'Failed to get unit documents';
    writeError(res, 500, message);
  }
};
