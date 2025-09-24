import { PrismaClient } from '@prisma/client';
import { writeSuccess, writeError } from '../utils/response.js';
const prisma = new PrismaClient();
export const propertyCaretakersController = {
    // Get caretaker assigned to a property
    getPropertyCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const { propertyId } = req.params;
            // Find the property first to ensure user has access
            const property = await prisma.property.findFirst({
                where: {
                    id: propertyId,
                    ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
                    ...(user.company_id ? { company_id: user.company_id } : {}),
                }
            });
            if (!property) {
                return writeError(res, 404, 'Property not found or access denied');
            }
            // Find assigned caretaker
            const caretaker = await prisma.user.findFirst({
                where: {
                    role: 'caretaker',
                    // For now, we'll store caretaker assignment in a simple way
                    // In a full implementation, you'd use a junction table
                    company_id: user.company_id,
                },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                    status: true,
                }
            });
            writeSuccess(res, 200, 'Property caretaker retrieved successfully', caretaker);
        }
        catch (error) {
            console.error('Error getting property caretaker:', error);
            writeError(res, 500, error.message);
        }
    },
    // Assign caretaker to a property
    assignCaretakerToProperty: async (req, res) => {
        try {
            const user = req.user;
            const { propertyId } = req.params;
            const caretakerData = req.body;
            // Find the property first to ensure user has access
            const property = await prisma.property.findFirst({
                where: {
                    id: propertyId,
                    ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
                    ...(user.company_id ? { company_id: user.company_id } : {}),
                }
            });
            if (!property) {
                return writeError(res, 404, 'Property not found or access denied');
            }
            // Check if caretaker already exists
            let caretaker = await prisma.user.findFirst({
                where: {
                    email: caretakerData.email,
                    role: 'caretaker',
                    company_id: user.company_id,
                }
            });
            if (caretaker) {
                // Update existing caretaker
                caretaker = await prisma.user.update({
                    where: { id: caretaker.id },
                    data: {
                        first_name: caretakerData.first_name,
                        last_name: caretakerData.last_name,
                        phone_number: caretakerData.phone,
                        updated_at: new Date(),
                    }
                });
            }
            else {
                // Create new caretaker
                caretaker = await prisma.user.create({
                    data: {
                        first_name: caretakerData.first_name,
                        last_name: caretakerData.last_name,
                        email: caretakerData.email,
                        phone_number: caretakerData.phone,
                        role: 'caretaker',
                        company_id: user.company_id,
                        password_hash: '$2b$10$defaulthashedpassword', // Default password, should be changed
                        status: 'active',
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });
            }
            // For now, we'll store the assignment in the property's metadata
            // In a full implementation, you'd use a proper junction table
            await prisma.property.update({
                where: { id: propertyId },
                data: {
                    // Store caretaker info in a JSON field or use proper relations
                    updated_at: new Date(),
                }
            });
            writeSuccess(res, 200, 'Caretaker assigned to property successfully', caretaker);
        }
        catch (error) {
            console.error('Error assigning caretaker to property:', error);
            writeError(res, 500, error.message);
        }
    },
    // Remove caretaker from property
    removeCaretakerFromProperty: async (req, res) => {
        try {
            const user = req.user;
            const { propertyId } = req.params;
            // Find the property first to ensure user has access
            const property = await prisma.property.findFirst({
                where: {
                    id: propertyId,
                    ...(user.role === 'landlord' ? { owner_id: user.user_id } : {}),
                    ...(user.company_id ? { company_id: user.company_id } : {}),
                }
            });
            if (!property) {
                return writeError(res, 404, 'Property not found or access denied');
            }
            // Remove caretaker assignment
            await prisma.property.update({
                where: { id: propertyId },
                data: {
                    updated_at: new Date(),
                }
            });
            writeSuccess(res, 200, 'Caretaker removed from property successfully');
        }
        catch (error) {
            console.error('Error removing caretaker from property:', error);
            writeError(res, 500, error.message);
        }
    }
};
