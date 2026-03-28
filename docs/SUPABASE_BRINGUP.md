# 🚀 Supabase Complete Bring-Up Guide for Ooga

**Complete Deployment Guide with Real Configuration**  
**Last Updated:** October 25, 2025  
**Target:** Production-ready Supabase backend

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Account Setup](#supabase-account-setup)
3. [Project Creation](#project-creation)
4. [Database Schema Setup](#database-schema-setup)
5. [Row Level Security Configuration](#row-level-security-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Testing the Setup](#testing-the-setup)
8. [Data Migration](#data-migration)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Modern web browser (Chrome, Firefox, Safari, Edge)
- ✅ Git for version control
- ✅ Text editor (VS Code recommended)

### Required Accounts
- ✅ GitHub account (for Supabase signup)
- ✅ Valid email address
- ✅ Internet connection

### Project Dependencies
```json
{
  "@supabase/supabase-js": "^2.75.0"
}
```

**Already installed in Ooga** - Check `package.json`

---

## Supabase Account Setup

### Step 1: Create Supabase Account

1. **Navigate to Supabase**
   ```
   https://supabase.com
   ```

2. **Click "Start your project"**
   - You'll be redirected to the signup page

3. **Sign Up Options:**
   - **Option A: GitHub (Recommended)**
     - Click "Continue with GitHub"
     - Authorize Supabase application
     - Automatic email verification
   
   - **Option B: Email**
     - Enter email address
     - Create password (min 8 characters)
     - Click verification link in email

4. **Complete Profile**
   - Organization name (e.g., "Personal Projects")
   - Team size (optional)
   - Use case (select "Personal Project")

### Step 2: Access Dashboard

Once logged in, you'll see the Supabase dashboard:
- Left sidebar: Project list
- Center: Quick actions
- Top right: User menu

---

## Project Creation

### Step 1: Create New Project

1. **Click "New Project" Button**
   - Located in the center of the dashboard
   - Or use left sidebar "New Project" link

2. **Select Organization**
   - Choose your personal organization
   - Or create a new one if needed

3. **Configure Project Settings**

   **Project Name:** `ooga-finance`
   - This is your project identifier
   - Used in URLs and database connections
   - Can be changed later

   **Database Password:**
   - Click "Generate a password" (recommended)
   - **CRITICAL:** Copy and save this password immediately
   - You'll need it for direct database access
   - Store in password manager or secure location
   
   **Example (DO NOT USE):**
   ```
   xK9#mP2$vL7@wN4&qR5
   ```

   **Region Selection:**
   - Choose geographically closest region
   - Affects latency and data compliance
   
   **Recommended Regions:**
   - US East (N. Virginia) - `us-east-1`
   - US West (Oregon) - `us-west-2`
   - Europe (Frankfurt) - `eu-central-1`
   - Asia Pacific (Singapore) - `ap-southeast-1`

   **Pricing Plan:**
   - Select "Free Tier" for development
   - Includes:
     - 500MB database space
     - 1GB file storage
     - 50,000 monthly active users
     - 2GB bandwidth

4. **Create Project**
   - Click "Create new project"
   - Wait 2-3 minutes for provisioning
   - You'll see a loading screen with progress

5. **Project Ready Notification**
   - Green checkmark when complete
   - You'll be redirected to project dashboard

### Step 2: Gather Project Credentials

**IMPORTANT:** Save these immediately!

1. **Navigate to Settings → API**
   - Click "Settings" in left sidebar
   - Select "API" section

2. **Copy Project URL**
   ```
   Project URL: https://xxxxxxxxxxxxxxxx.supabase.co
   ```
   **Example (your actual URL will differ):**
   ```
   https://kfbxwmhzqvxrjlpncdye.supabase.co
   ```

3. **Copy anon/public Key**
   ```
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   **This is a long JWT token (hundreds of characters)**

4. **Save service_role Key (Optional)**
   - For admin operations only
   - **Keep this secret** - never expose in client code
   - Only needed for server-side operations

---

## Database Schema Setup

### Step 1: Open SQL Editor

1. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Or go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql

2. **Create New Query**
   - Click "+ New query" button
   - Name it: "Initial Schema Setup"

### Step 2: Create Database Tables

**Copy and run this complete SQL script:**

```sql
-- ============================================
-- OOGA FINANCE TRACKER - DATABASE SCHEMA
-- Version: 1.0
-- Created: October 2025
-- ============================================

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1: Budget Configurations
-- Stores user-specific budget settings
-- ============================================
CREATE TABLE public.budget_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  warning_notifications BOOLEAN DEFAULT true,
  email_alerts BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one config per user
  CONSTRAINT unique_user_config UNIQUE(user_id)
);

-- Add helpful comment
COMMENT ON TABLE public.budget_configs IS 'Global budget configuration per user';

-- ============================================
-- TABLE 2: Budget Categories
-- Individual category limits and settings
-- ============================================
CREATE TABLE public.budget_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_config_id UUID REFERENCES public.budget_configs(id) ON DELETE CASCADE NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  monthly_limit DECIMAL(10,2) NOT NULL CHECK (monthly_limit >= 0),
  warning_threshold INTEGER DEFAULT 80 CHECK (warning_threshold >= 0 AND warning_threshold <= 100),
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(7),  -- Hex color code (e.g., #3B82F6)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique category names per config
  CONSTRAINT unique_category_per_config UNIQUE(budget_config_id, category_name)
);

COMMENT ON TABLE public.budget_categories IS 'Budget limits for each expense category';

-- ============================================
-- TABLE 3: Family Members
-- Track who made each transaction
-- ============================================
CREATE TABLE public.family_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,  -- Hex color code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.family_members IS 'Family members for transaction attribution';

-- ============================================
-- TABLE 4: Transactions
-- Core financial transactions
-- ============================================
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.transactions IS 'All income and expense transactions';

-- ============================================
-- TABLE 5: Budgets (Monthly Tracking)
-- Monthly budget tracking and spent amounts
-- ============================================
CREATE TABLE public.budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category VARCHAR(100) NOT NULL,
  budget_amount DECIMAL(10,2) NOT NULL CHECK (budget_amount >= 0),
  spent_amount DECIMAL(10,2) DEFAULT 0 CHECK (spent_amount >= 0),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique budget per category per month
  CONSTRAINT unique_budget_per_month UNIQUE(user_id, category, month, year)
);

COMMENT ON TABLE public.budgets IS 'Monthly budget tracking with spent amounts';

-- ============================================
-- INDEXES: For Performance
-- ============================================

-- Transactions indexes (most queried table)
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(category);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- Budget configs index
CREATE INDEX idx_budget_configs_user_id ON public.budget_configs(user_id);

-- Budget categories indexes
CREATE INDEX idx_budget_categories_config_id ON public.budget_categories(budget_config_id);
CREATE INDEX idx_budget_categories_active ON public.budget_categories(is_active);

-- Family members index
CREATE INDEX idx_family_members_user_id ON public.family_members(user_id);

-- Budgets indexes
CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_month_year ON public.budgets(year, month);

-- ============================================
-- FUNCTIONS: Auto-update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_budget_configs_updated_at
  BEFORE UPDATE ON public.budget_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'Database schema created successfully!' AS status,
       'Tables: 5' AS tables_created,
       'Indexes: 11' AS indexes_created,
       'Triggers: 3' AS triggers_created;
```

3. **Execute the Script**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for execution (should take < 5 seconds)
   - Verify success message appears

4. **Verify Tables Created**
   - Navigate to "Table Editor" in left sidebar
   - You should see 5 tables:
     ✅ budget_configs
     ✅ budget_categories
     ✅ family_members
     ✅ transactions
     ✅ budgets

---

## Row Level Security Configuration

### Why RLS Matters
- **Data Isolation:** Users only see their own data
- **Security:** Prevents unauthorized access
- **Zero Trust:** Even compromised credentials can't access other users' data

### Step 1: Enable RLS on All Tables

```sql
-- Enable Row Level Security
ALTER TABLE public.budget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

SELECT 'Row Level Security enabled on all tables' AS status;
```

### Step 2: Create RLS Policies

**Run this complete policy script:**

```sql
-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Ooga Finance Tracker
-- ============================================

-- ============================================
-- BUDGET CONFIGS POLICIES
-- ============================================

CREATE POLICY "Users can view own budget config"
  ON public.budget_configs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget config"
  ON public.budget_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget config"
  ON public.budget_configs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget config"
  ON public.budget_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- BUDGET CATEGORIES POLICIES
-- ============================================

CREATE POLICY "Users can view own budget categories"
  ON public.budget_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_configs
      WHERE budget_configs.id = budget_categories.budget_config_id
      AND budget_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own budget categories"
  ON public.budget_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_configs
      WHERE budget_configs.id = budget_categories.budget_config_id
      AND budget_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own budget categories"
  ON public.budget_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_configs
      WHERE budget_configs.id = budget_categories.budget_config_id
      AND budget_configs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_configs
      WHERE budget_configs.id = budget_categories.budget_config_id
      AND budget_configs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own budget categories"
  ON public.budget_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_configs
      WHERE budget_configs.id = budget_categories.budget_config_id
      AND budget_configs.user_id = auth.uid()
    )
  );

-- ============================================
-- FAMILY MEMBERS POLICIES
-- ============================================

CREATE POLICY "Users can view own family members"
  ON public.family_members
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own family members"
  ON public.family_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family members"
  ON public.family_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own family members"
  ON public.family_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================

CREATE POLICY "Users can view own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- BUDGETS POLICIES
-- ============================================

CREATE POLICY "Users can view own budgets"
  ON public.budgets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON public.budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON public.budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON public.budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- VERIFY POLICIES
-- ============================================

SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

### Step 3: Verify RLS Setup

```sql
-- Check all policies are in place
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Expected Output:**
- 5 tables
- 4 policies each (SELECT, INSERT, UPDATE, DELETE)
- 20 total policies

---

## Environment Configuration

### Step 1: Create .env File

In your Ooga project root directory:

```bash
# Windows PowerShell
New-Item -ItemType File -Path .env

# Or use VS Code
# File -> New File -> Save as ".env"
```

### Step 2: Add Supabase Credentials

**Template:**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Development settings
VITE_ENABLE_DEBUG=false
```

**Real Example (with your actual values):**
```env
# Supabase Configuration for Ooga
# Project: ooga-finance
# Created: October 2025

VITE_SUPABASE_URL=https://kfbxwmhzqvxrjlpncdye.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnh3bWh6cXZ4cmpscG5jZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTcxMTY4MDAsImV4cCI6MjAxMjY5MjgwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**IMPORTANT:**
- ⚠️ Replace with YOUR actual values from Supabase dashboard
- ⚠️ Never commit .env to version control
- ✅ .env is already in .gitignore

### Step 3: Verify .gitignore

Check that `.env` is ignored:

```bash
# Check .gitignore contents
cat .gitignore | grep -i ".env"
```

Should show:
```
.env
.env.local
.env.*.local
```

### Step 4: Restart Development Server

After adding .env:

```bash
# Stop current dev server (Ctrl+C)

# Restart to load environment variables
npm run dev
```

---

## Testing the Setup

### Step 1: Test Connection

Create a test file: `test-supabase-connection.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl ? '✓ Found' : '✗ Missing')
console.log('Key:', supabaseKey ? '✓ Found' : '✗ Missing')

if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  console.log('✓ Supabase client created successfully')
} else {
  console.error('✗ Missing environment variables')
}
```

Run:
```bash
node test-supabase-connection.js
```

### Step 2: Test Authentication

In your browser console:

```javascript
// Should be available after login
console.log('Supabase client:', supabase)
console.log('Current session:', await supabase.auth.getSession())
```

### Step 3: Create Test User

1. **Navigate to Authentication in Supabase Dashboard**
   - Click "Authentication" in left sidebar
   - Click "Users" tab

2. **Add User Manually (Optional)**
   - Click "Add user"
   - Enter email: `test@ooga.local`
   - Enter password: `TestPass123!`
   - Check "Auto Confirm User"
   - Click "Create user"

3. **Or Use Signup Flow**
   - Run your app: `npm run dev`
   - Navigate to `/register`
   - Fill out registration form
   - Check email for verification link
   - Click verification link

### Step 4: Test Data Operations

After logging in:

```javascript
// Test adding a transaction
const { data, error } = await supabase
  .from('transactions')
  .insert({
    date: '2025-10-25',
    description: 'Test Transaction',
    amount: 100.00,
    category: 'Groceries',
    type: 'expense'
  })
  .select()

console.log('Insert result:', data, error)
```

---

## Data Migration

### Option 1: Automatic Migration (Recommended)

The app includes built-in migration functionality:

1. **User logs in for first time**
2. **App detects localStorage data**
3. **Prompts user to migrate**
4. **Automatic transfer to Supabase**

### Option 2: Manual Migration Script

Create `migrate-data.js`:

```javascript
import { supabase } from './src/lib/supabase'

async function migrateLocalStorageToSupabase() {
  console.log('Starting data migration...')
  
  // Get localStorage data
  const transactions = JSON.parse(localStorage.getItem('ooga-transactions') || '[]')
  const familyMembers = JSON.parse(localStorage.getItem('ooga-members') || '[]')
  const budgetConfig = JSON.parse(localStorage.getItem('ooga-budget-config') || '{}')
  
  console.log(`Found ${transactions.length} transactions`)
  console.log(`Found ${familyMembers.length} family members`)
  
  try {
    // Migrate family members first (referenced by transactions)
    for (const member of familyMembers) {
      const { error } = await supabase
        .from('family_members')
        .insert({
          name: member.name,
          color: member.color
        })
      
      if (error) throw error
    }
    console.log('✓ Family members migrated')
    
    // Migrate transactions
    for (const tx of transactions) {
      const { error } = await supabase
        .from('transactions')
        .insert({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          family_member_id: tx.familyMember
        })
      
      if (error) throw error
    }
    console.log('✓ Transactions migrated')
    
    console.log('✓ Migration complete!')
    
  } catch (error) {
    console.error('✗ Migration failed:', error)
  }
}

// Run migration
migrateLocalStorageToSupabase()
```

---

## Production Deployment

### Step 1: Environment Variables (Production)

**For Vite/Vercel/Netlify:**

Set these in your hosting platform:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 2: Build Application

```bash
npm run build
```

Verify `dist/` directory created

### Step 3: Deploy

**Vercel:**
```bash
vercel --prod
```

**Netlify:**
```bash
netlify deploy --prod
```

### Step 4: Configure Authentication Redirect URLs

In Supabase Dashboard:

1. **Go to Authentication → URL Configuration**
2. **Add Site URL:**
   ```
   https://your-domain.com
   ```
3. **Add Redirect URLs:**
   ```
   https://your-domain.com/
   https://your-domain.com/login
   https://your-domain.com/register
   ```

### Step 5: Test Production Environment

1. Visit your deployed URL
2. Create account
3. Add transaction
4. Verify data in Supabase Table Editor

---

## Troubleshooting

### Common Issues

#### 1. "Invalid API key" Error

**Symptoms:**
- Login fails
- Can't fetch data
- Console shows 401 error

**Solutions:**
```bash
# Verify environment variables loaded
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Restart dev server
npm run dev
```

#### 2. "No rows returned" (RLS Issue)

**Symptoms:**
- Can't see own data
- Insert succeeds but SELECT returns empty

**Solutions:**
```sql
-- Verify RLS policies exist
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check current user
SELECT auth.uid();

-- Temporarily disable RLS for debugging (DON'T DO IN PRODUCTION)
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
```

#### 3. "Email not confirmed"

**Symptoms:**
- User created but can't login
- Email verification required

**Solutions:**
- Check spam folder
- Manually confirm in Supabase Dashboard:
  - Authentication → Users
  - Find user → Click → Mark as confirmed

#### 4. CORS Errors

**Symptoms:**
- Network errors in browser
- Blocked by CORS policy

**Solutions:**
- Verify Site URL in Supabase settings
- Check Authentication redirect URLs
- Ensure https:// (not http://) in production

#### 5. Connection Timeout

**Symptoms:**
- Slow queries
- Timeout errors
- Connection refused

**Solutions:**
- Check Supabase service status: https://status.supabase.com
- Verify region selection (use closest)
- Check network/firewall settings

---

## Performance Optimization

### Database Indexes

Already created! See schema setup.

### Connection Pooling

Supabase handles automatically.

### Caching Strategy

```javascript
// Example: Cache frequently accessed data
const getCachedBudgetConfig = async () => {
  const cached = sessionStorage.getItem('budget_config')
  if (cached) return JSON.parse(cached)
  
  const { data } = await supabase
    .from('budget_configs')
    .select('*')
    .single()
  
  sessionStorage.setItem('budget_config', JSON.stringify(data))
  return data
}
```

---

## Monitoring & Maintenance

### Monitor Usage

**Supabase Dashboard → Settings → Usage**
- Database size
- Bandwidth usage
- Active users
- API requests

### Set Up Alerts

**Supabase Dashboard → Settings → Billing**
- Usage threshold alerts
- Email notifications
- Upgrade prompts

### Backup Strategy

**Automatic Backups:**
- Supabase Pro: Daily backups
- Free Tier: Weekly backups (retained 7 days)

**Manual Backups:**
```bash
# Export data
npx supabase db dump -f backup.sql

# Restore data
psql -h db.xxx.supabase.co -U postgres -d postgres -f backup.sql
```

---

## Security Best Practices

### ✅ DO

- ✅ Use RLS on all tables
- ✅ Keep anon key public-facing only
- ✅ Store service_role key securely (server-side only)
- ✅ Use HTTPS in production
- ✅ Enable email verification
- ✅ Implement rate limiting
- ✅ Monitor suspicious activity
- ✅ Keep dependencies updated

### ❌ DON'T

- ❌ Commit .env to version control
- ❌ Expose service_role key in client
- ❌ Disable RLS in production
- ❌ Use weak passwords
- ❌ Skip email verification
- ❌ Ignore security updates

---

## Resources

### Official Documentation
- **Supabase Docs:** https://supabase.com/docs
- **Authentication Guide:** https://supabase.com/docs/guides/auth
- **Database Guide:** https://supabase.com/docs/guides/database
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security

### Community
- **Discord:** https://discord.supabase.com
- **GitHub:** https://github.com/supabase/supabase
- **Forum:** https://github.com/supabase/supabase/discussions

### Support
- **Status Page:** https://status.supabase.com
- **Support Email:** support@supabase.com
- **Enterprise Support:** Available on Pro/Team plans

---

## Appendix: Complete Configuration Summary

### Project Settings
```
Project Name: ooga-finance
Region: [Your selected region]
Database: PostgreSQL 15
```

### Tables Created
- budget_configs (1)
- budget_categories (2)
- family_members (3)
- transactions (4)
- budgets (5)

### Indexes Created
- 11 performance indexes

### RLS Policies
- 20 security policies (4 per table)

### Environment Variables
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

---

**🎉 Congratulations!**

Your Supabase backend for Ooga is now fully operational and production-ready!

**Next Steps:**
1. Test authentication flow
2. Add your first transaction
3. Invite family members
4. Start budgeting!

---

**Maintained by:** Maor Galkin  
**Last Updated:** October 25, 2025  
**Version:** 1.0
