import multer from 'multer';
import { imagekitService } from '../services/imagekit.service.js';
import { PropertiesService } from '../services/properties.service.js';
import { UnitsService } from '../services/units.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const propertiesService = new PropertiesService();
const unitsService = new UnitsService();
// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check if file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
export const uploadPropertyImages = async (req, res) => {
    try {
        const user = req.user;
        const { id: propertyId } = req.params;
        if (!propertyId) {
            return writeError(res, 400, 'Property ID is required');
        }
        // Verify property exists and user has access
        try {
            await propertiesService.getProperty(propertyId, user);
        }
        catch (error) {
            return writeError(res, 404, 'Property not found or access denied');
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return writeError(res, 400, 'No images provided');
        }
        // Upload images to ImageKit
        const uploadPromises = files.map(async (file, index) => {
            const fileName = `property-${propertyId}-${Date.now()}-${index}`;
            const uploadResult = await imagekitService.uploadFile(file.buffer, fileName, `properties/${propertyId}`);
            return {
                url: uploadResult.url,
                fileId: uploadResult.fileId,
                name: uploadResult.name,
                isPrimary: index === 0, // First image is primary
            };
        });
        const uploadedImages = await Promise.all(uploadPromises);
        // Get current property to merge with existing images
        const property = await propertiesService.getProperty(propertyId, user);
        const currentImages = Array.isArray(property.images) ? property.images : [];
        // Add new images to existing ones
        const updatedImages = [...currentImages, ...uploadedImages];
        // Update property with new images
        await propertiesService.updateProperty(propertyId, { images: updatedImages }, user);
        writeSuccess(res, 200, 'Images uploaded successfully', {
            images: uploadedImages,
            totalImages: updatedImages.length,
        });
    }
    catch (error) {
        console.error('Error uploading property images:', error);
        const message = error.message || 'Failed to upload images';
        writeError(res, 500, message);
    }
};
export const deletePropertyImage = async (req, res) => {
    try {
        const user = req.user;
        const { id: propertyId, imageId } = req.params;
        if (!propertyId || !imageId) {
            return writeError(res, 400, 'Property ID and Image ID are required');
        }
        // Verify property exists and user has access
        const property = await propertiesService.getProperty(propertyId, user);
        const currentImages = Array.isArray(property.images) ? property.images : [];
        // Find and remove the image
        const imageToDelete = currentImages.find((img) => img.fileId === imageId);
        if (!imageToDelete) {
            return writeError(res, 404, 'Image not found');
        }
        // Delete from ImageKit
        await imagekitService.deleteFile(imageId);
        // Remove from property images array
        const updatedImages = currentImages.filter((img) => img.fileId !== imageId);
        // Update property
        await propertiesService.updateProperty(propertyId, { images: updatedImages }, user);
        writeSuccess(res, 200, 'Image deleted successfully', {
            deletedImageId: imageId,
            remainingImages: updatedImages.length,
        });
    }
    catch (error) {
        console.error('Error deleting property image:', error);
        const message = error.message || 'Failed to delete image';
        writeError(res, 500, message);
    }
};
export const uploadUnitImages = async (req, res) => {
    try {
        const user = req.user;
        const { id: unitId } = req.params;
        if (!unitId) {
            return writeError(res, 400, 'Unit ID is required');
        }
        // Verify unit exists and user has access
        try {
            await unitsService.getUnit(unitId, user);
        }
        catch (error) {
            return writeError(res, 404, 'Unit not found or access denied');
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return writeError(res, 400, 'No images provided');
        }
        // Upload images to ImageKit
        const uploadPromises = files.map(async (file, index) => {
            const fileName = `unit-${unitId}-${Date.now()}-${index}`;
            const uploadResult = await imagekitService.uploadFile(file.buffer, fileName, `units/${unitId}`);
            return {
                url: uploadResult.url,
                fileId: uploadResult.fileId,
                name: uploadResult.name,
                isPrimary: index === 0, // First image is primary
            };
        });
        const uploadedImages = await Promise.all(uploadPromises);
        // Get current unit to merge with existing images
        const unit = await unitsService.getUnit(unitId, user);
        const currentImages = Array.isArray(unit.images) ? unit.images : [];
        // Add new images to existing ones
        const updatedImages = [...currentImages, ...uploadedImages];
        // Update unit with new images
        await unitsService.updateUnit(unitId, { images: updatedImages }, user);
        writeSuccess(res, 200, 'Images uploaded successfully', {
            images: uploadedImages,
            totalImages: updatedImages.length,
        });
    }
    catch (error) {
        console.error('Error uploading unit images:', error);
        const message = error.message || 'Failed to upload images';
        writeError(res, 500, message);
    }
};
export const deleteUnitImage = async (req, res) => {
    try {
        const user = req.user;
        const { id: unitId, imageId } = req.params;
        if (!unitId || !imageId) {
            return writeError(res, 400, 'Unit ID and Image ID are required');
        }
        // Verify unit exists and user has access
        const unit = await unitsService.getUnit(unitId, user);
        const currentImages = Array.isArray(unit.images) ? unit.images : [];
        // Find and remove the image
        const imageToDelete = currentImages.find((img) => img.fileId === imageId);
        if (!imageToDelete) {
            return writeError(res, 404, 'Image not found');
        }
        // Delete from ImageKit
        await imagekitService.deleteFile(imageId);
        // Remove from unit images array
        const updatedImages = currentImages.filter((img) => img.fileId !== imageId);
        // Update unit
        await unitsService.updateUnit(unitId, { images: updatedImages }, user);
        writeSuccess(res, 200, 'Image deleted successfully', {
            deletedImageId: imageId,
            remainingImages: updatedImages.length,
        });
    }
    catch (error) {
        console.error('Error deleting unit image:', error);
        const message = error.message || 'Failed to delete image';
        writeError(res, 500, message);
    }
};
// Multer middleware export
export const uploadMiddleware = upload.array('images', 10); // Max 10 images
