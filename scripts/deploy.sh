#!/bin/bash

# Deployment script for LetRents Backend
# Usage: ./scripts/deploy.sh [dev|production]

set -e

ENVIRONMENT=${1:-dev}
APP_NAME="letrents-backend"
APP_DIR="/var/www/${APP_NAME}"

if [ "$ENVIRONMENT" = "production" ]; then
    APP_NAME="letrents-backend"
    APP_DIR="/var/www/${APP_NAME}"
    BRANCH="main"
else
    APP_NAME="letrents-backend-dev"
    APP_DIR="/var/www/${APP_NAME}"
    BRANCH="dev"
fi

echo "🚀 Deploying LetRents Backend to $ENVIRONMENT environment..."
echo "📁 App directory: $APP_DIR"
echo "🌿 Branch: $BRANCH"

# Navigate to app directory
cd "$APP_DIR" || exit 1

# Pull latest code
echo "📥 Pulling latest code from $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build application
echo "🔨 Building application..."
npm run build

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Restart application with PM2
echo "🔄 Restarting application..."
pm2 restart "$APP_NAME" || pm2 start dist/src/index.js --name "$APP_NAME" --update-env
pm2 save

# Health check
echo "🏥 Performing health check..."
sleep 5
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Deployment successful! Health check passed."
else
    echo "❌ Health check failed. Please check the logs: pm2 logs $APP_NAME"
    exit 1
fi

echo "✨ Deployment completed successfully!"

