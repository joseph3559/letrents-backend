#!/bin/bash

# Database Restore Script for LetRents Backend
# Usage: ./scripts/restore-db.sh [dev|production] <backup_file>

set -e

ENVIRONMENT=${1:-dev}
BACKUP_FILE=${2}

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file is required"
    echo "Usage: ./scripts/restore-db.sh [dev|production] <backup_file>"
    exit 1
fi

# Database configuration based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    DB_NAME="letrents_prod"
    DB_USER="letrents_user"
else
    DB_NAME="letrents_dev"
    DB_USER="letrents_user"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm restore
echo "⚠️  WARNING: This will restore the database $DB_NAME from backup"
echo "📁 Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo "🔄 Restoring database..."

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    TEMP_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    BACKUP_FILE="$TEMP_FILE"
fi

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

# Restore database
if PGPASSWORD="${DB_PASSWORD}" pg_restore -h localhost -U "$DB_USER" -d "$DB_NAME" -c "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Database restored successfully!"
    
    # Clean up temp file if created
    if [ -n "$TEMP_FILE" ]; then
        rm -f "$TEMP_FILE"
    fi
else
    echo "❌ Restore failed!"
    exit 1
fi

