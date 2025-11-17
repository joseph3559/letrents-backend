#!/bin/bash

# Create Super Admin User Script for VPS
# Creates super admin user in both production and development databases
# Usage: bash scripts/create-super-admin-vps.sh

set -e

EMAIL="scottjoe3559@gmail.com"
PASSWORD="Scott@2030?"
FIRST_NAME="Scott"
LAST_NAME="Joe"

echo "🔐 Creating super admin user in both environments..."
echo "   Email: $EMAIL"
echo "   Name: $FIRST_NAME $LAST_NAME"
echo ""

# Production
echo "📦 Creating super admin in PRODUCTION database..."
cd /var/www/letrents-backend
node scripts/create-super-admin.js "$EMAIL" "$PASSWORD" "$FIRST_NAME" "$LAST_NAME"

echo ""
echo "📦 Creating super admin in DEVELOPMENT database..."
cd /var/www/letrents-backend-dev
node scripts/create-super-admin.js "$EMAIL" "$PASSWORD" "$FIRST_NAME" "$LAST_NAME"

echo ""
echo "✅ Super admin created successfully in both environments!"
echo ""
echo "📝 Login credentials:"
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo ""
echo "🌐 Production API: https://api.letrents.com"
echo "🌐 Development API: https://dev-api.letrents.com"

