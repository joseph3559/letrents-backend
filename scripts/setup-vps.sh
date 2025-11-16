#!/bin/bash

# VPS Setup Script for LetRents Backend
# This script sets up the VPS for deployment
# Run as root: sudo bash scripts/setup-vps.sh

set -e

echo "🚀 Setting up VPS for LetRents Backend deployment..."

# Update system
echo "📦 Updating system packages..."
yum update -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
fi

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    dnf install -y postgresql15 postgresql15-server postgresql15-contrib
    postgresql-15-setup initdb
    systemctl enable postgresql-15
    systemctl start postgresql-15
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    pm2 startup systemd -u root --hp /root
fi

# Install Git
echo "📦 Installing Git..."
yum install -y git

# Install Nginx (optional, for reverse proxy)
echo "📦 Installing Nginx..."
yum install -y nginx

# Create application directories
echo "📁 Creating application directories..."
mkdir -p /var/www/letrents-backend
mkdir -p /var/www/letrents-backend-dev
mkdir -p /var/backups/letrents/production
mkdir -p /var/backups/letrents/development
mkdir -p /var/log/letrents

# Create PostgreSQL databases and users
echo "🗄️  Setting up PostgreSQL databases..."
sudo -u postgres psql <<EOF
-- Create production database
CREATE DATABASE letrents_prod;
CREATE USER letrents_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE letrents_prod TO letrents_user;

-- Create development database
CREATE DATABASE letrents_dev;
GRANT ALL PRIVILEGES ON DATABASE letrents_dev TO letrents_user;

-- Enable UUID extension
\c letrents_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\c letrents_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant schema privileges
\c letrents_prod
GRANT ALL ON SCHEMA public TO letrents_user;
\c letrents_dev
GRANT ALL ON SCHEMA public TO letrents_user;
EOF

# Configure PostgreSQL to allow connections
echo "🔧 Configuring PostgreSQL..."
PG_HBA_FILE="/var/lib/pgsql/15/data/pg_hba.conf"
if ! grep -q "letrents_user" "$PG_HBA_FILE"; then
    echo "host    letrents_prod    letrents_user    127.0.0.1/32    md5" >> "$PG_HBA_FILE"
    echo "host    letrents_dev    letrents_user    127.0.0.1/32    md5" >> "$PG_HBA_FILE"
    systemctl restart postgresql-15
fi

# Set up firewall
echo "🔥 Configuring firewall..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=8080/tcp
    firewall-cmd --reload
fi

# Create backup cron job
echo "⏰ Setting up automatic backups..."
cat > /etc/cron.daily/letrents-backup <<'CRONEOF'
#!/bin/bash
/var/www/letrents-backend/scripts/backup-db.sh production
/var/www/letrents-backend/scripts/backup-db.sh dev
CRONEOF
chmod +x /etc/cron.daily/letrents-backup

# Create systemd service for PM2 (optional)
echo "⚙️  Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root

echo "✅ VPS setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Clone your repository to /var/www/letrents-backend"
echo "2. Clone your repository to /var/www/letrents-backend-dev"
echo "3. Set up environment variables (.env files)"
echo "4. Update PostgreSQL password: ALTER USER letrents_user WITH PASSWORD 'your_secure_password';"
echo "5. Run database migrations"
echo "6. Start the applications with PM2"

