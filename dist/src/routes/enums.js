import { Router } from 'express';
import { enumsController } from '../controllers/enums.controller.js';
const router = Router();
// Get all enums
router.get('/', enumsController.getEnums);
// Get specific enum types
router.get('/unit-conditions', enumsController.getUnitConditions);
export default router;
