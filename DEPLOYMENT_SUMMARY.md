# 📋 Deployment Setup Summary

## ✅ What Has Been Created

### 1. GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- **Automatic deployment** when pushing to `dev` branch (development)
- **Automatic deployment** when pushing to `main` branch (production)
- **Test suite** runs on pull requests to `main`
- Uses SSH to deploy to your VPS

### 2. Deployment Scripts (`scripts/`)
- **`deploy.sh`**: Manual deployment script for both environments
- **`backup-db.sh`**: Database backup script with automatic compression
- **`restore-db.sh`**: Database restore script
- **`setup-vps.sh`**: Initial VPS setup script (installs all dependencies)
- **`setup-backup-cron.sh`**: Sets up automatic daily backups

### 3. Documentation
- **`DEPLOYMENT.md`**: Comprehensive deployment guide
- **`QUICK_START_DEPLOYMENT.md`**: Quick start guide for fast setup
- **`.env.production.example`**: Production environment template
- **`.env.development.example`**: Development environment template

## 🎯 Deployment Flow

```
┌─────────────────┐
│  Push to dev    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │
│  (Build & Test) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy to Dev  │
│  (VPS: 8080)    │
└─────────────────┘

┌─────────────────┐
│ Push to main    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitHub Actions  │
│  (Build & Test) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy to Prod  │
│  (VPS: 8080)    │
└─────────────────┘
```

## 🗄️ Database Setup

### Two Separate Databases:
1. **Development**: `letrents_dev` (for `dev` branch)
2. **Production**: `letrents_prod` (for `main` branch)

### Automatic Backups:
- **Frequency**: Daily (via cron)
- **Location**: 
  - Production: `/var/backups/letrents/production/`
  - Development: `/var/backups/letrents/development/`
- **Retention**: 30 days (automatic cleanup)
- **Format**: Compressed SQL dumps (`.sql.gz`)

## 🔐 Security Features

1. **Separate environments**: Dev and production are completely isolated
2. **Environment variables**: Sensitive data stored in `.env` files (not in git)
3. **Database passwords**: Stored securely, not hardcoded
4. **PM2 process management**: Applications run as services
5. **Automatic backups**: Daily backups prevent data loss

## 📝 Next Steps

### 1. Set Up GitHub Secrets
Go to: Repository → Settings → Secrets and variables → Actions

Add:
- `VPS_HOST`: `159.198.70.44`
- `VPS_USERNAME`: `root`
- `VPS_PASSWORD`: `C7RtgiT857B9IzXu0v`

### 2. Initial VPS Setup
```bash
ssh root@159.198.70.44
# Follow QUICK_START_DEPLOYMENT.md
```

### 3. Test Deployment
```bash
# Push to dev branch
git checkout dev
git push origin dev

# Check GitHub Actions for deployment status
# Verify: curl http://159.198.70.44:8080/health
```

## 🛠️ Maintenance Commands

### View Logs
```bash
pm2 logs letrents-backend        # Production
pm2 logs letrents-backend-dev    # Development
```

### Restart Applications
```bash
pm2 restart letrents-backend
pm2 restart letrents-backend-dev
```

### Manual Backup
```bash
bash /var/www/letrents-backend/scripts/backup-db.sh production
bash /var/www/letrents-backend-dev/scripts/backup-db.sh dev
```

### Manual Deployment
```bash
bash /var/www/letrents-backend/scripts/deploy.sh production
bash /var/www/letrents-backend-dev/scripts/deploy.sh dev
```

## 📊 Monitoring

### Health Checks
- Production: `http://159.198.70.44:8080/health`
- Development: `http://159.198.70.44:8080/health` (if on different port)

### PM2 Monitoring
```bash
pm2 list          # List all processes
pm2 monit         # Real-time monitoring
pm2 status        # Process status
```

### Backup Status
```bash
ls -lh /var/backups/letrents/production/
ls -lh /var/backups/letrents/development/
```

## 🚨 Troubleshooting

### Application Won't Start
1. Check logs: `pm2 logs letrents-backend`
2. Verify environment: `pm2 env letrents-backend`
3. Check database connection
4. Verify port availability: `netstat -tulpn | grep 8080`

### Deployment Fails
1. Check GitHub Actions logs
2. Verify SSH connectivity: `ssh root@159.198.70.44`
3. Check repository access
4. Verify environment variables

### Database Issues
1. Test connection: `sudo -u postgres psql -d letrents_prod`
2. Check PostgreSQL status: `systemctl status postgresql-15`
3. View logs: `tail -f /var/lib/pgsql/15/data/log/postgresql-*.log`

## 📚 Documentation Files

- **`DEPLOYMENT.md`**: Full deployment guide with all details
- **`QUICK_START_DEPLOYMENT.md`**: Quick setup guide
- **`README.md`**: General project documentation
- **`PRODUCTION_READY.md`**: Production readiness checklist

## ✨ Features

✅ **Automatic CI/CD**: Push to branch → Auto-deploy  
✅ **Separate Environments**: Dev and production isolated  
✅ **Database Backups**: Daily automatic backups  
✅ **Process Management**: PM2 for reliable service management  
✅ **Health Monitoring**: Health check endpoints  
✅ **Rollback Support**: Easy restore from backups  
✅ **Security**: Environment variables, separate databases  

---

**Ready to deploy?** Follow the [QUICK_START_DEPLOYMENT.md](./QUICK_START_DEPLOYMENT.md) guide!

