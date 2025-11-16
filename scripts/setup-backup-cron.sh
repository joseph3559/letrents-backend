#!/bin/bash

# Setup Backup Cron Job
# This script sets up automatic daily backups with password handling

set -e

echo "⏰ Setting up automatic backup cron job..."

# Create backup script wrapper that sources environment
cat > /usr/local/bin/letrents-backup-wrapper <<'WRAPPEREOF'
#!/bin/bash
# Source environment variables from .env files
if [ -f /var/www/letrents-backend/.env ]; then
    export $(grep -v '^#' /var/www/letrents-backend/.env | grep DATABASE_URL | sed 's/.*:\/\/\([^:]*\):\([^@]*\)@.*/DB_USER=\1\nDB_PASSWORD=\2/' | xargs)
fi

# Run backups
/var/www/letrents-backend/scripts/backup-db.sh production
/var/www/letrents-backend/scripts/backup-db.sh dev
WRAPPEREOF

chmod +x /usr/local/bin/letrents-backup-wrapper

# Create cron job
cat > /etc/cron.daily/letrents-backup <<'CRONEOF'
#!/bin/bash
/usr/local/bin/letrents-backup-wrapper >> /var/log/letrents/backup.log 2>&1
CRONEOF

chmod +x /etc/cron.daily/letrents-backup

echo "✅ Backup cron job configured!"
echo "📝 Backups will run daily at system cron.daily time"
echo "📋 Logs will be written to /var/log/letrents/backup.log"

