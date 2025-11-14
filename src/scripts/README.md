# Scripts Documentation

## fix-landlords-agencies-companies.ts

### Purpose
This script ensures data integrity by verifying that all landlords and agency admins have associated `company_id` values and that all companies have proper names. It fixes any inconsistencies found in the database.

### What It Does

1. **Finds landlords without company_id**: Identifies all users with role `landlord` that don't have a `company_id` set
2. **Finds agency admins without company_id**: Identifies all users with role `agency_admin` that don't have a `company_id` set
3. **Creates companies for missing users**: For each landlord or agency admin without a company:
   - Generates an appropriate company name (e.g., "John Doe Properties" for landlords, "John Doe Agency" for agency admins)
   - Checks if a company with that name already exists
   - Creates a new company if needed with default settings
   - Assigns the `company_id` to the user
4. **Fixes agencies table**: Updates any agencies in the `agency` table that are missing `company_id`
5. **Fixes companies without names**: Identifies companies with null or empty names and generates appropriate names based on associated users
6. **Verifies fixes**: After processing, verifies that all issues have been resolved

### Usage

```bash
# From the backend v2 directory
npx ts-node src/scripts/fix-landlords-agencies-companies.ts
```

### Output

The script provides detailed console output including:
- Number of landlords and agency admins found without company_id
- Progress for each user being processed
- Summary of fixes applied
- Final verification results

### Example Output

```
🔍 Checking for landlords and agencies without company_id...

📋 Found 5 landlords without company_id
📋 Found 2 agency_admins without company_id

📋 Processing landlord: John Doe (john@example.com)
   ✅ Created company: "John Doe Properties" (ID: abc123)
   ✅ Assigned company_id to landlord

...

🔍 Verifying fixes...

============================================================
📊 Summary:
   Landlords fixed: 5
   Agency admins fixed: 2
   Company names fixed: 0
   Errors: 0

📊 Remaining issues:
   Landlords without company_id: 0
   Agency admins without company_id: 0
   Companies without names: 0
============================================================

✅ All landlords and agencies now have company_id and company names!
```

### When to Run

- After data migration or import
- When investigating data integrity issues
- As part of regular maintenance
- After bulk user creation operations
- When the diagnostic endpoint (`/super-admin/system/company-integrity`) reports issues

### Related Endpoints

- **GET `/super-admin/system/company-integrity`**: Diagnostic endpoint to check for landlords and agencies without company_id without making changes

### Notes

- The script is idempotent - it's safe to run multiple times
- It will not overwrite existing company assignments
- Company names are generated based on user names if not provided
- Default company settings are applied (starter plan, 100 properties, 1000 units, etc.)
- All companies created have status 'pending' by default

### Error Handling

- Individual errors are logged but don't stop the script
- The script continues processing remaining users even if some fail
- A summary of errors is provided at the end
- Exit code 0 indicates success, exit code 1 indicates failure

