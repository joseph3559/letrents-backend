#!/bin/bash

# Database Backup Script for LetRents Backend
# Usage: ./scripts/backup-db.sh [dev|production]

set -e

ENVIRONMENT=${1:-dev}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/letrents"
RETENTION_DAYS=30

# Database configuration based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    DB_NAME="letrents_prod"
    DB_USER="letrents_user"
    BACKUP_DIR="${BACKUP_DIR}/production"
else
    DB_NAME="letrents_dev"
    DB_USER="letrents_user"
    BACKUP_DIR="${BACKUP_DIR}/development"
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup filename
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"

echo "🗄️  Starting database backup for $ENVIRONMENT environment..."
echo "📁 Database: $DB_NAME"
echo "💾 Backup file: $BACKUP_FILE_COMPRESSED"

# Get database password from DATABASE_URL or prompt
if [ -z "$DB_PASSWORD" ]; then
    # Try to extract from DATABASE_URL if set
    if [ -n "$DATABASE_URL" ]; then
        DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    fi
    
    # If still empty, prompt
    if [ -z "$DB_PASSWORD" ]; then
        echo "Enter PostgreSQL password for $DB_USER:"
        read -s DB_PASSWORD
    fi
fi

# Perform backup
if PGPASSWORD="${DB_PASSWORD}" pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE" 2>/dev/null; then
    # Compress backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup created successfully: $BACKUP_FILE_COMPRESSED"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
    echo "📊 Backup size: $BACKUP_SIZE"
    
    # Clean up old backups (keep last 30 days)
    echo "🧹 Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "✅ Old backups cleaned up"
    
    # List remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f | wc -l)
    echo "📦 Total backups in directory: $BACKUP_COUNT"
    
    exit 0
else
    echo "❌ Backup failed!"
    exit 1
fi

