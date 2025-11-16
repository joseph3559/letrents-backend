# Step-by-Step VPS Setup Commands

Run these commands one by one on your VPS:

## Step 1: Check Scripts Directory

```bash
cd /tmp/letrents-setup
ls -la scripts/
```

## Step 2: Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

## Step 3: Run VPS Setup Script

```bash
bash scripts/setup-vps.sh
```

This will install:
- Node.js 20
- PostgreSQL 15
- PM2
- Git
- Nginx
- Create directories
- Set up databases

## Step 4: After Setup Completes

Once the setup script finishes, you'll need to:

1. **Set PostgreSQL password:**
```bash
sudo -u postgres psql
ALTER USER letrents_user WITH PASSWORD 'your_secure_password_here';
\q
```

2. **Clone repositories to production locations:**
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

3. **Set up environment variables** (we'll do this next)

4. **Initialize databases** (we'll do this next)

5. **Start applications** (we'll do this next)

Let's start with Step 1 - check what scripts you have!

