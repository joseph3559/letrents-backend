import { Router } from 'express';
import { getCompanySubaccount, upsertCompanySubaccount, resolvePaystackAccount, } from '../controllers/payments.controller.js';
// Backward-compatible alias routes (legacy clients use /payment/* instead of /payments/*)
const router = Router();
router.get('/subaccount', getCompanySubaccount);
router.post('/subaccount', upsertCompanySubaccount);
router.get('/subaccount/resolve', resolvePaystackAccount);
export default router;
