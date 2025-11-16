# VPS Setup - Step by Step Commands

Run these commands on your VPS (you're already logged in as root):

## Step 1: Check Repository Structure

```bash
cd /tmp/letrents-setup
ls -la
```

This will show you what's actually in the repository.

## Step 2: Find the Backend Directory

The repository might have a different structure. Try:

```bash
# Option 1: If "backend v2" exists
cd "/tmp/letrents-setup/backend v2"

# Option 2: If it's just "backend"
cd /tmp/letrents-setup/backend

# Option 3: If it's in the root
cd /tmp/letrents-setup

# Option 4: Check all subdirectories
find /tmp/letrents-setup -type d -name "*backend*"
```

## Step 3: Once You Find the Backend Directory

Once you're in the correct directory (where `package.json` exists), run:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run the VPS setup script
bash scripts/setup-vps.sh
```

## Alternative: If Repository Structure is Different

If the repository structure is completely different, you can:

1. **Clone directly to the target location:**
```bash
# Production
cd /var/www
git clone https://github.com/joseph3559/letrents-backend.git letrents-backend
cd letrents-backend
git checkout main

# Development  
cd /var/www
git clone https://github.com/joseph3559/letrents-backend.git letrents-backend-dev
cd letrents-backend-dev
git checkout dev
```

2. **Then run setup manually:**
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Install PostgreSQL
dnf install -y postgresql15 postgresql15-server postgresql15-contrib
postgresql-15-setup initdb
systemctl enable postgresql-15
systemctl start postgresql-15

# Install PM2
npm install -g pm2

# Create directories
mkdir -p /var/backups/letrents/production
mkdir -p /var/backups/letrents/development
```

## Quick Check Commands

Run these to see what you have:

```bash
# See repository structure
cd /tmp/letrents-setup
find . -type f -name "package.json" | head -5

# See if backend v2 exists
ls -la | grep backend

# See all directories
tree -L 2  # if tree is installed
# OR
find . -maxdepth 2 -type d
```

