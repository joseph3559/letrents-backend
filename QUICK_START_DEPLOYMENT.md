# 🚀 Quick Start Deployment Guide

This is a condensed guide to get your backend deployed quickly. For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Step 1: Initial VPS Setup (One-time)

SSH into your VPS and run:

```bash
ssh root@159.198.70.44
# Password: C7RtgiT857B9IzXu0v

# Clone your repository (or upload files)
cd /tmp
git clone <your-repo-url> letrents-setup
cd letrents-setup/backend\ v2

# Run setup script
chmod +x scripts/setup-vps.sh
bash scripts/setup-vps.sh
```

## Step 2: Clone Repositories

```bash
# Production
cd /var/www
git clone <your-repo-url> letrents-backend
cd letrents-backend
git checkout main

# Development
cd /var/www
git clone <your-repo-url> letrents-backend-dev
cd letrents-backend-dev
git checkout dev
```

## Step 3: Configure Databases

```bash
# Set PostgreSQL password
sudo -u postgres psql
ALTER USER letrents_user WITH PASSWORD 'your_secure_password';
\q
```

## Step 4: Set Up Environment Variables

**Production** (`/var/www/letrents-backend/.env`):
```bash
cp .env.production.example .env
nano .env  # Edit with your values
```

**Development** (`/var/www/letrents-backend-dev/.env`):
```bash
cp .env.development.example .env
nano .env  # Edit with your values
```

**Important**: Update `DATABASE_URL` with your PostgreSQL password!

## Step 5: Initialize Databases

```bash
# Production
cd /var/www/letrents-backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# Development
cd /var/www/letrents-backend-dev
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

## Step 6: Start Applications

```bash
# Production
cd /var/www/letrents-backend
pm2 start dist/src/index.js --name letrents-backend --update-env
pm2 save

# Development
cd /var/www/letrents-backend-dev
pm2 start dist/src/index.js --name letrents-backend-dev --update-env
pm2 save
```

## Step 7: Set Up GitHub Actions

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `VPS_HOST`: `159.198.70.44`
   - `VPS_USERNAME`: `root`
   - `VPS_PASSWORD`: `C7RtgiT857B9IzXu0v`

## Step 8: Set Up Automatic Backups

```bash
# Create backup script wrapper
bash /var/www/letrents-backend/scripts/setup-backup-cron.sh

# Or manually set up cron
chmod +x /var/www/letrents-backend/scripts/backup-db.sh
chmod +x /var/www/letrents-backend-dev/scripts/backup-db.sh
```

## That's It! 🎉

Now:
- **Push to `dev` branch** → Auto-deploys to development
- **Push to `main` branch** → Auto-deploys to production
- **Backups run daily** automatically

## Verify Everything Works

```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs letrents-backend

# Test health endpoint
curl http://localhost:8080/health
```

## Common Commands

```bash
# View logs
pm2 logs letrents-backend

# Restart app
pm2 restart letrents-backend

# Manual backup
bash /var/www/letrents-backend/scripts/backup-db.sh production

# Manual deployment
bash /var/www/letrents-backend/scripts/deploy.sh production
```

## Troubleshooting

**App won't start?**
```bash
pm2 logs letrents-backend --lines 100
```

**Database connection issues?**
```bash
# Test connection
sudo -u postgres psql -d letrents_prod -U letrents_user
```

**Need to restore?**
```bash
bash /var/www/letrents-backend/scripts/restore-db.sh production /path/to/backup.sql.gz
```

For more details, see [DEPLOYMENT.md](./DEPLOYMENT.md).

