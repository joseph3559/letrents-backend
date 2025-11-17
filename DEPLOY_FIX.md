# Quick Deploy Fix for Dev Server

Run these commands on the VPS to fix the deployment:

```bash
cd /var/www/letrents-backend-dev

# Reset any local changes in dist/ directory
git checkout -- dist/
git clean -fd dist/

# Pull latest changes
git pull origin dev

# Install ALL dependencies (not just production - needed for building)
npm ci

# Build the application
npm run build

# Generate Prisma client
npx prisma generate

# Restart the application
pm2 restart letrents-backend-dev
pm2 save
```

This will:
1. Reset conflicting dist/ files
2. Pull the latest code (including CORS fix)
3. Install dev dependencies needed for building (like @types/jest)
4. Build with the new CORS configuration
5. Restart the server with the updated code

After this, the CORS headers should include `user-email` and `User-Email`.

