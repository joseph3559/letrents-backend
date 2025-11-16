# 🚀 Deployment Guide for LetRents Backend

This guide covers the complete setup and deployment process for the LetRents Backend on your VPS.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial VPS Setup](#initial-vps-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [GitHub Actions Configuration](#github-actions-configuration)
6. [Backup and Restore](#backup-and-restore)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

- VPS with AlmaLinux 9 (or similar)
- Root access to the VPS
- GitHub repository with your code
- Domain name (optional, for production)

## Initial VPS Setup

### 1. Connect to Your VPS

```bash
ssh root@159.198.70.44
# Password: C7RtgiT857B9IzXu0v
```

### 2. Run the Setup Script

```bash
# Clone the repository first (or upload the setup script)
git clone <your-repo-url> /tmp/letrents-setup
cd /tmp/letrents-setup/backend\ v2
chmod +x scripts/setup-vps.sh
sudo bash scripts/setup-vps.sh
```

This script will install:
- Node.js 20
- PostgreSQL 15
- PM2 (Process Manager)
- Git
- Nginx (optional)
- Required directories and permissions

### 3. Clone Your Repository

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

## Database Setup

### 1. Set PostgreSQL Password

```bash
sudo -u postgres psql
ALTER USER letrents_user WITH PASSWORD 'your_secure_password_here';
\q
```

### 2. Create Environment Files

**Production (`/var/www/letrents-backend/.env`):**
```env
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

DATABASE_URL=postgresql://letrents_user:your_secure_password@localhost:5432/letrents_prod?schema=public

JWT_SECRET=your-production-jwt-secret-key-change-this
JWT_EXPIRATION_HOURS=24
JWT_REFRESH_EXPIRATION_HOURS=168

APP_URL=https://letrents.com
API_URL=https://api.letrents.com

# Add your other environment variables here
IMAGEKIT_PRIVATE_KEY=your-key
IMAGEKIT_PUBLIC_KEY=your-key
IMAGEKIT_ENDPOINT_URL=your-url

BREVO_API_KEY=your-key
EMAIL_FROM_ADDRESS=noreply@letrents.com
EMAIL_FROM_NAME=LetRents

PAYSTACK_SECRET_KEY=your-key
PAYSTACK_PUBLIC_KEY=your-key
RENT_PAYSTACK_SECRET_KEY=your-key
RENT_PAYSTACK_PUBLIC_KEY=your-key
```

**Development (`/var/www/letrents-backend-dev/.env`):**
```env
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

DATABASE_URL=postgresql://letrents_user:your_secure_password@localhost:5432/letrents_dev?schema=public

JWT_SECRET=your-dev-jwt-secret-key
JWT_EXPIRATION_HOURS=24
JWT_REFRESH_EXPIRATION_HOURS=168

APP_URL=http://159.198.70.44:3000
API_URL=http://159.198.70.44:8080

# Add your other environment variables here
# (Use test/development keys)
```

### 3. Initialize Databases

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

## Application Deployment

### 1. Start Applications with PM2

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

### 2. Verify Applications are Running

```bash
pm2 list
pm2 logs letrents-backend
pm2 logs letrents-backend-dev
```

### 3. Test Health Endpoints

```bash
curl http://localhost:8080/health
```

## GitHub Actions Configuration

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- `VPS_HOST`: `159.198.70.44`
- `VPS_USERNAME`: `root`
- `VPS_PASSWORD`: `C7RtgiT857B9IzXu0v`

**⚠️ Security Note:** Consider using SSH keys instead of passwords for better security.

### 2. Workflow Behavior

- **Push to `dev` branch**: Automatically deploys to development environment
- **Push to `main` branch**: Automatically deploys to production environment
- **Pull Request to `main`**: Runs tests only (no deployment)

### 3. Manual Deployment

If you need to deploy manually:

```bash
# SSH into VPS
ssh root@159.198.70.44

# Run deployment script
cd /var/www/letrents-backend
bash scripts/deploy.sh production

# Or for development
cd /var/www/letrents-backend-dev
bash scripts/deploy.sh dev
```

## Backup and Restore

### Automatic Backups

Backups run daily via cron job at `/etc/cron.daily/letrents-backup`. Backups are stored in:
- Production: `/var/backups/letrents/production/`
- Development: `/var/backups/letrents/development/`

Backups are kept for 30 days automatically.

### Manual Backup

```bash
# Production
bash /var/www/letrents-backend/scripts/backup-db.sh production

# Development
bash /var/www/letrents-backend-dev/scripts/backup-db.sh dev
```

### Restore from Backup

```bash
# Production
bash /var/www/letrents-backend/scripts/restore-db.sh production /var/backups/letrents/production/backup_letrents_prod_20240115_120000.sql.gz

# Development
bash /var/www/letrents-backend-dev/scripts/restore-db.sh dev /var/backups/letrents/development/backup_letrents_dev_20240115_120000.sql.gz
```

## Monitoring and Maintenance

### PM2 Commands

```bash
# List all processes
pm2 list

# View logs
pm2 logs letrents-backend
pm2 logs letrents-backend-dev

# Restart application
pm2 restart letrents-backend
pm2 restart letrents-backend-dev

# Stop application
pm2 stop letrents-backend

# Monitor resources
pm2 monit
```

### Database Maintenance

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# List databases
\l

# Connect to specific database
\c letrents_prod
\c letrents_dev

# View tables
\dt

# Exit
\q
```

### Log Files

- Application logs: `pm2 logs`
- System logs: `/var/log/messages`
- Nginx logs: `/var/log/nginx/`

### Health Checks

Set up monitoring to check:
- `http://159.198.70.44:8080/health` (Production)
- `http://159.198.70.44:8080/health` (Development, if on different port)

## Nginx Reverse Proxy (Optional)

If you want to use Nginx as a reverse proxy:

```nginx
# /etc/nginx/conf.d/letrents.conf
server {
    listen 80;
    server_name api.letrents.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then restart Nginx:
```bash
systemctl restart nginx
```

## Security Recommendations

1. **Change Default Passwords**: Update PostgreSQL password and root password
2. **Use SSH Keys**: Replace password authentication with SSH keys
3. **Firewall**: Ensure only necessary ports are open
4. **SSL/TLS**: Set up SSL certificates (Let's Encrypt) for production
5. **Regular Updates**: Keep system packages updated
6. **Backup Verification**: Regularly test backup restoration

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs letrents-backend --lines 100

# Check if port is in use
netstat -tulpn | grep 8080

# Check environment variables
pm2 env letrents-backend
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
sudo -u postgres psql -d letrents_prod

# Check PostgreSQL status
systemctl status postgresql-15

# Check PostgreSQL logs
tail -f /var/lib/pgsql/15/data/log/postgresql-*.log
```

### Deployment Fails

```bash
# Check GitHub Actions logs
# Verify secrets are set correctly
# Check SSH connectivity
ssh root@159.198.70.44

# Verify git repository access
cd /var/www/letrents-backend
git pull origin main
```

## Support

For issues or questions:
1. Check application logs: `pm2 logs`
2. Check GitHub Actions workflow logs
3. Review this deployment guide
4. Check database backup status

---

**Last Updated**: 2024-01-15
**Version**: 2.0.0

