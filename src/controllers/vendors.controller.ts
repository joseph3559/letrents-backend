import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const prisma = getPrisma();

export const listVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as JWTClaims;
    if (!user.company_id) {
      writeError(res, 403, 'User must be associated with a company');
      return;
    }
    const search = (req.query.search as string)?.trim();
    const where: any = { company_id: user.company_id };
    if (search && search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { service_type: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    const data = vendors.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category ?? v.service_type,
      service_type: v.service_type ?? v.category,
      phone: v.phone,
      email: v.email,
      address: v.address,
      created_at: v.created_at,
      updated_at: v.updated_at,
    }));
    writeSuccess(res, 200, 'Vendors retrieved successfully', data);
  } catch (error: any) {
    console.error('Vendors list error:', error);
    writeError(res, 500, error.message || 'Failed to retrieve vendors');
  }
};

export const createVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as JWTClaims;
    if (!user.company_id) {
      writeError(res, 403, 'User must be associated with a company');
      return;
    }
    const body = req.body;
    const name = (body.name || '').toString().trim();
    if (!name) {
      writeError(res, 400, 'Vendor name is required');
      return;
    }
    const vendor = await prisma.vendor.create({
      data: {
        company_id: user.company_id,
        name,
        category: body.category?.trim() || null,
        service_type: body.service_type?.trim() || body.category?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
      },
    });
    const data = {
      id: vendor.id,
      name: vendor.name,
      category: vendor.category ?? vendor.service_type,
      service_type: vendor.service_type ?? vendor.category,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
    };
    writeSuccess(res, 201, 'Vendor created successfully', data);
  } catch (error: any) {
    console.error('Vendor create error:', error);
    writeError(res, 500, error.message || 'Failed to create vendor');
  }
};

export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as JWTClaims;
    if (!user.company_id) {
      writeError(res, 403, 'User must be associated with a company');
      return;
    }
    const id = req.params.id;
    const existing = await prisma.vendor.findFirst({
      where: { id, company_id: user.company_id },
    });
    if (!existing) {
      writeError(res, 404, 'Vendor not found');
      return;
    }
    const body = req.body;
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(body.name != null && { name: String(body.name).trim() }),
        ...(body.category !== undefined && { category: body.category?.trim() || null }),
        ...(body.service_type !== undefined && { service_type: body.service_type?.trim() || null }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.email !== undefined && { email: body.email?.trim() || null }),
        ...(body.address !== undefined && { address: body.address?.trim() || null }),
        updated_at: new Date(),
      },
    });
    const data = {
      id: vendor.id,
      name: vendor.name,
      category: vendor.category ?? vendor.service_type,
      service_type: vendor.service_type ?? vendor.category,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
    };
    writeSuccess(res, 200, 'Vendor updated successfully', data);
  } catch (error: any) {
    console.error('Vendor update error:', error);
    writeError(res, 500, error.message || 'Failed to update vendor');
  }
};

export const deleteVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as JWTClaims;
    if (!user.company_id) {
      writeError(res, 403, 'User must be associated with a company');
      return;
    }
    const id = req.params.id;
    const existing = await prisma.vendor.findFirst({
      where: { id, company_id: user.company_id },
    });
    if (!existing) {
      writeError(res, 404, 'Vendor not found');
      return;
    }
    await prisma.vendor.delete({ where: { id } });
    writeSuccess(res, 200, 'Vendor deleted successfully', null);
  } catch (error: any) {
    console.error('Vendor delete error:', error);
    writeError(res, 500, error.message || 'Failed to delete vendor');
  }
};
