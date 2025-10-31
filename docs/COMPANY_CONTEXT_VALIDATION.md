# Company Context Validation System

## Overview

This system ensures that all staff members (caretakers, agents, security, etc.) are always created with proper company association (`company_id`). This prevents data isolation issues where staff members from different companies cannot see each other.

## Problem Statement

**Before:** Staff members could be created with `null` or incorrect `company_id`, leading to:
- Staff members not appearing in the company's staff list
- Data isolation issues
- Security concerns (staff accessing wrong company data)
- Difficulty in troubleshooting

**After:** Multiple layers of validation ensure staff members always have correct `company_id`.

## Validation Layers

### 1. Frontend Validation
**File:** `frontend/src/components/caretaker/AddCaretakerModal.tsx`

- Displays user-friendly error messages
- Handles specific error codes from backend
- Shows longer toast notifications for critical errors

**Error Messages:**
- `MISSING_COMPANY_CONTEXT`: Account not properly configured
- Generic errors: Instructs user to contact support

### 2. Middleware Validation
**File:** `backend v2/src/middleware/companyContext.ts`

- `requireCompanyContext`: Ensures user has `company_id` before creating staff
- `requireAgencyContext`: Ensures user has `agency_id` for agency operations
- `logCompanyContext`: Logs context for debugging (development only)

**Applied to routes:**
```typescript
router.post('/', requireCompanyContext, rbacResource('caretakers', 'create'), ...);
```

### 3. Service Layer Validation
**File:** `backend v2/src/services/staff.service.ts`

Multiple checks in `createStaffMember`:

1. **User Validation:** Creator must have `company_id`
   ```typescript
   if (!user.company_id) {
     throw new Error('Your account is not associated with a company');
   }
   ```

2. **Role-Based Assignment:**
   - `agency_admin`: Always uses their `company_id`
   - `landlord`: Uses their `company_id`
   - `super_admin`: Must explicitly provide `company_id`

3. **Final Validation:** Before database insertion
   ```typescript
   if (!createData.company_id) {
     throw new Error('company_id is required');
   }
   ```

4. **Audit Logging:** Logs all staff creation attempts
   ```typescript
   console.log('✅ Creating staff member:', {
     role, email, company_id, created_by, creator_role
   });
   ```

### 4. Database Cleanup Script
**File:** `backend v2/scripts/fix-staff-company-ids.js`

Fixes existing data issues:
- Finds staff with `null` company_id
- Attempts to fix by looking up creator's company
- Reports on fixable and unfixable issues

**Usage:**
```bash
cd "backend v2"
node scripts/fix-staff-company-ids.js
```

## How It Works

### Staff Creation Flow

```
User clicks "Add Staff"
    ↓
Frontend validates form
    ↓
API Request to POST /caretakers
    ↓
Middleware: requireCompanyContext
  └─ Checks if user.company_id exists
  └─ Returns 403 if missing
    ↓
Service: createStaffMember
  └─ Validates user.company_id
  └─ Assigns company_id based on role
  └─ Final validation before DB insert
  └─ Logs creation for audit trail
    ↓
Database: User created with company_id
    ↓
Email invitation sent
    ↓
Success response to frontend
```

### Error Handling

**Backend Errors:**
```json
{
  "success": false,
  "message": "Your account is not associated with a company. Please contact support.",
  "error_code": "MISSING_COMPANY_CONTEXT"
}
```

**Frontend Handling:**
- Catches error
- Checks `error_code` for specific handling
- Shows user-friendly message via toast
- Displays error in form

## Maintenance

### Adding New Staff Roles

When adding new staff roles (e.g., `manager`, `supervisor`):

1. **Update Middleware:**
   - No changes needed (applies to all staff creation)

2. **Update Service:**
   - Add role to validation if needed
   - Ensure role-based logic includes new role

3. **Update Cleanup Script:**
   - Add new role to the `role: { in: [...] }` array

### Monitoring

**Check for staff with null company_id:**
```sql
SELECT id, first_name, last_name, email, role
FROM users
WHERE role IN ('caretaker', 'agent', 'security', 'cleaner', 'maintenance')
  AND company_id IS NULL;
```

**Check staff company distribution:**
```sql
SELECT company_id, COUNT(*) as staff_count
FROM users
WHERE role IN ('caretaker', 'agent', 'security', 'cleaner', 'maintenance')
GROUP BY company_id
ORDER BY staff_count DESC;
```

## Testing

### Manual Testing

1. **Create staff as agency_admin:**
   ```bash
   # Should succeed if agency_admin has company_id
   POST /api/v1/caretakers
   # Verify: staff.company_id === agency_admin.company_id
   ```

2. **Create staff with broken account:**
   ```sql
   -- Temporarily remove company_id
   UPDATE users SET company_id = NULL WHERE id = 'test-user-id';
   
   -- Try to create staff
   POST /api/v1/caretakers
   -- Should return 403 with MISSING_COMPANY_CONTEXT
   ```

3. **Run cleanup script:**
   ```bash
   node scripts/fix-staff-company-ids.js
   # Should report 0 issues after fixes
   ```

### Automated Testing

Add tests in `backend v2/tests/staff.test.ts`:

```typescript
describe('Staff Creation Validation', () => {
  it('should reject staff creation when user has no company_id', async () => {
    // Test implementation
  });

  it('should assign correct company_id from agency_admin', async () => {
    // Test implementation
  });

  it('should log staff creation for audit trail', async () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Issue: Staff not appearing in list

**Diagnosis:**
1. Check staff's `company_id`:
   ```sql
   SELECT id, email, company_id FROM users WHERE id = 'staff-id';
   ```

2. Check user's `company_id`:
   ```sql
   SELECT id, email, company_id FROM users WHERE id = 'user-id';
   ```

3. Compare: If different, staff won't appear

**Solution:**
- Run cleanup script: `node scripts/fix-staff-company-ids.js`
- Or manually update: `UPDATE users SET company_id = 'correct-id' WHERE id = 'staff-id';`

### Issue: 403 error when creating staff

**Diagnosis:**
1. Check backend logs for `❌ CRITICAL: User attempting action without company_id`
2. Verify user's JWT token includes `company_id`

**Solution:**
- User account needs `company_id` assigned
- Contact support or update manually in database

### Issue: Staff created with wrong company_id

**Diagnosis:**
1. Check backend logs for staff creation
2. Review creator's `company_id`

**Solution:**
- Should not happen with current validation
- If it does, indicates validation bypass
- Report as critical bug

## Related Files

- `backend v2/src/services/staff.service.ts` - Main validation logic
- `backend v2/src/middleware/companyContext.ts` - Middleware validation
- `backend v2/src/routes/caretakers.ts` - Route protection
- `backend v2/scripts/fix-staff-company-ids.js` - Cleanup script
- `frontend/src/components/caretaker/AddCaretakerModal.tsx` - Error handling

## Changelog

### 2025-10-26
- ✅ Added multi-layer validation system
- ✅ Created middleware for company context validation
- ✅ Added audit logging for staff creation
- ✅ Created cleanup script for existing data
- ✅ Enhanced frontend error handling
- ✅ Added comprehensive documentation

---

**Maintainer:** Development Team  
**Last Updated:** October 26, 2025  
**Version:** 1.0.0

