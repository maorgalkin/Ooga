-- ============================================================================
-- OOGA UNIFIED DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- Created: December 2025
-- Description: Complete database schema for Ooga family finance tracker
-- 
-- This script creates all tables, indexes, RLS policies, functions, and triggers
-- needed for a fresh Supabase project.
--
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. HOUSEHOLDS TABLE
-- ============================================================================
-- Groups users together to share financial data

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_households_created_by ON households(created_by);
CREATE INDEX IF NOT EXISTS idx_households_created_at ON households(created_at DESC);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. HOUSEHOLD MEMBERS TABLE
-- ============================================================================
-- Join table connecting users to households with roles

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- One user can only be in one household
  CONSTRAINT unique_user_household UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_role ON household_members(role);

-- Partial unique index: Only one owner per household
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_one_owner
  ON household_members(household_id)
  WHERE role = 'owner';

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. SECURITY DEFINER FUNCTIONS (to avoid RLS recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION user_is_in_household(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION user_is_household_owner_or_admin(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_household_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  SELECT household_id INTO v_household_id
  FROM household_members
  WHERE user_id = p_user_id;
  
  RETURN v_household_id;
END;
$$;

-- ============================================================================
-- 4. HOUSEHOLD RLS POLICIES
-- ============================================================================

-- Households: Users can view households they belong to
CREATE POLICY "Users can view own household"
  ON households FOR SELECT
  USING (user_is_in_household(id));

CREATE POLICY "Household creators can update"
  ON households FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Household Members
CREATE POLICY "Users can view own membership"
  ON household_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view same household members"
  ON household_members FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert own membership"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete members"
  ON household_members FOR DELETE
  USING (user_is_household_owner_or_admin(household_id));

CREATE POLICY "Owners can update members"
  ON household_members FOR UPDATE
  USING (user_is_household_owner_or_admin(household_id));

-- ============================================================================
-- 5. FAMILY MEMBERS TABLE
-- ============================================================================
-- Represents family members for expense tracking (not app users)

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  household_member_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_household ON family_members(household_id);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household family members"
  ON family_members FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household family members"
  ON family_members FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household family members"
  ON family_members FOR UPDATE
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can delete household family members"
  ON family_members FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 6. CATEGORIES TABLE
-- ============================================================================
-- Stores budget categories

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  color TEXT,
  type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'both')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_category_name_per_user UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(user_id, is_active) WHERE deleted_at IS NULL;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household categories"
  ON categories FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household categories"
  ON categories FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household categories"
  ON categories FOR UPDATE
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can delete household categories"
  ON categories FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 7. TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  family_member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date_range ON transactions(household_id, date);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household transactions"
  ON transactions FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household transactions"
  ON transactions FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household transactions"
  ON transactions FOR UPDATE
  USING (user_is_in_household(household_id))
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can delete household transactions"
  ON transactions FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 8. PERSONAL BUDGETS TABLE
-- ============================================================================
-- Stores the user's baseline/ideal budget configuration

CREATE TABLE IF NOT EXISTS personal_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  version INT DEFAULT 1 NOT NULL,
  name TEXT DEFAULT 'Personal Budget' NOT NULL,
  categories JSONB NOT NULL,
  global_settings JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_budgets_one_active_per_household 
  ON personal_budgets(household_id) 
  WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_personal_budgets_user_id ON personal_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_budgets_household ON personal_budgets(household_id);
CREATE INDEX IF NOT EXISTS idx_personal_budgets_created_at ON personal_budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_budgets_categories ON personal_budgets USING GIN (categories jsonb_path_ops);

ALTER TABLE personal_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household personal budgets"
  ON personal_budgets FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household personal budgets"
  ON personal_budgets FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household personal budgets"
  ON personal_budgets FOR UPDATE
  USING (user_is_in_household(household_id))
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can delete household personal budgets"
  ON personal_budgets FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 9. MONTHLY BUDGETS TABLE
-- ============================================================================
-- Stores the active budget for each month
-- 
-- BUDGET ARCHITECTURE:
--   • original_categories: Baseline snapshot at month creation (immutable "Original Budget")
--   • categories: Current permanent state for that month (editable "Current Budget")
-- 
-- EDIT vs ADJUST:
--   • Edit: Updates categories for current month (permanent for that month)
--   • Adjust: Schedules change to personal_budgets, affects future months' original_categories
-- 
-- LEGACY NAMING (for historical reference, not exposed in UI):
--   • "Original Budget" formerly called "month-start baseline"
--   • "Current Budget" formerly called "adjusted budget" or "mid-month changes"
--   • Both names preserved in analytics for backward compatibility

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  personal_budget_id UUID REFERENCES personal_budgets(id) ON DELETE SET NULL,
  year INT NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  categories JSONB NOT NULL,  -- Current permanent budget (editable)
  original_categories JSONB NOT NULL,  -- Month-start baseline (immutable)
  global_settings JSONB NOT NULL,
  adjustment_count INT DEFAULT 0 NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes TEXT,
  
  CONSTRAINT unique_household_year_month UNIQUE(household_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_id ON monthly_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_household ON monthly_budgets(household_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_year_month ON monthly_budgets(household_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_personal_budget ON monthly_budgets(personal_budget_id);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_created_at ON monthly_budgets(created_at DESC);

ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household monthly budgets"
  ON monthly_budgets FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household monthly budgets"
  ON monthly_budgets FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household monthly budgets"
  ON monthly_budgets FOR UPDATE
  USING (user_is_in_household(household_id))
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can delete household monthly budgets"
  ON monthly_budgets FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 10. BUDGET ADJUSTMENTS TABLE
-- ============================================================================
-- Stores scheduled adjustments for future months

CREATE TABLE IF NOT EXISTS budget_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  current_limit DECIMAL(10, 2) NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  adjustment_amount DECIMAL(10, 2) NOT NULL CHECK (adjustment_amount > 0),
  new_limit DECIMAL(10, 2) NOT NULL CHECK (new_limit >= 0),
  effective_year INT NOT NULL CHECK (effective_year >= 2020 AND effective_year <= 2100),
  effective_month INT NOT NULL CHECK (effective_month >= 1 AND effective_month <= 12),
  reason TEXT,
  is_applied BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  applied_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_adjustments_one_pending_per_category
  ON budget_adjustments(household_id, category_name, effective_year, effective_month)
  WHERE (is_applied = false);

CREATE INDEX IF NOT EXISTS idx_budget_adjustments_user_id ON budget_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_adjustments_household ON budget_adjustments(household_id);
CREATE INDEX IF NOT EXISTS idx_budget_adjustments_effective_date ON budget_adjustments(effective_year, effective_month);
CREATE INDEX IF NOT EXISTS idx_budget_adjustments_category ON budget_adjustments(household_id, category_name);

ALTER TABLE budget_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household budget adjustments"
  ON budget_adjustments FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household budget adjustments"
  ON budget_adjustments FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household budget adjustments"
  ON budget_adjustments FOR UPDATE
  USING (user_is_in_household(household_id))
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can delete household budget adjustments"
  ON budget_adjustments FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 11. CATEGORY ADJUSTMENT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_adjustment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  adjustment_count INT DEFAULT 0 NOT NULL,
  last_adjusted_at TIMESTAMPTZ,
  total_increased_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  total_decreased_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  first_adjustment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT unique_household_category_history UNIQUE(household_id, category_name)
);

CREATE INDEX IF NOT EXISTS idx_category_history_user_id ON category_adjustment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_category_history_household ON category_adjustment_history(household_id);
CREATE INDEX IF NOT EXISTS idx_category_history_category ON category_adjustment_history(category_name);

ALTER TABLE category_adjustment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household adjustment history"
  ON category_adjustment_history FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household adjustment history"
  ON category_adjustment_history FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

CREATE POLICY "Users can update household adjustment history"
  ON category_adjustment_history FOR UPDATE
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can delete household adjustment history"
  ON category_adjustment_history FOR DELETE
  USING (user_is_in_household(household_id));

-- ============================================================================
-- 12. USER ALERT VIEWS TABLE
-- ============================================================================
-- Tracks which budget alerts users have viewed/dismissed

CREATE TABLE IF NOT EXISTS user_alert_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  
  CONSTRAINT unique_user_alert UNIQUE(user_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_user_alert_views_user ON user_alert_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_views_household ON user_alert_views(household_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_views_alert_id ON user_alert_views(alert_id);

ALTER TABLE user_alert_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert views"
  ON user_alert_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own alert views"
  ON user_alert_views FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND user_is_in_household(household_id)
  );

CREATE POLICY "Users can delete own alert views"
  ON user_alert_views FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 13. CATEGORY MERGE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  source_category_id UUID NOT NULL,
  source_category_name TEXT NOT NULL,
  target_category_id UUID NOT NULL,
  target_category_name TEXT NOT NULL,
  transactions_moved INT DEFAULT 0,
  merged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_category_merge_history_user ON category_merge_history(user_id);
CREATE INDEX IF NOT EXISTS idx_category_merge_history_household ON category_merge_history(household_id);

ALTER TABLE category_merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household merge history"
  ON category_merge_history FOR SELECT
  USING (user_is_in_household(household_id));

CREATE POLICY "Users can insert household merge history"
  ON category_merge_history FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

-- ============================================================================
-- 14. HELPER FUNCTIONS
-- ============================================================================

-- RPC function to get household members with display names
CREATE OR REPLACE FUNCTION get_household_members_with_emails(p_household_id UUID)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  invited_by UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hm.id,
    hm.household_id,
    hm.user_id,
    hm.role::TEXT,
    hm.joined_at,
    hm.invited_by,
    COALESCE(
      au.raw_user_meta_data->>'first_name',
      SPLIT_PART((au.raw_user_meta_data->>'full_name'), ' ', 1),
      SPLIT_PART(au.email::TEXT, '@', 1),
      'Unknown'
    ) as email
  FROM public.household_members hm
  LEFT JOIN auth.users au ON hm.user_id = au.id
  WHERE hm.household_id = p_household_id
  ORDER BY hm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_household_members_with_emails(UUID) TO authenticated;

-- Function to update category adjustment history
CREATE OR REPLACE FUNCTION update_category_adjustment_history(
  p_user_id UUID,
  p_household_id UUID,
  p_category_name TEXT,
  p_adjustment_type TEXT,
  p_adjustment_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO category_adjustment_history (
    user_id,
    household_id,
    category_name,
    adjustment_count,
    last_adjusted_at,
    total_increased_amount,
    total_decreased_amount,
    first_adjustment_at
  ) VALUES (
    p_user_id,
    p_household_id,
    p_category_name,
    1,
    NOW(),
    CASE WHEN p_adjustment_type = 'increase' THEN p_adjustment_amount ELSE 0 END,
    CASE WHEN p_adjustment_type = 'decrease' THEN p_adjustment_amount ELSE 0 END,
    NOW()
  )
  ON CONFLICT (household_id, category_name)
  DO UPDATE SET
    adjustment_count = category_adjustment_history.adjustment_count + 1,
    last_adjusted_at = NOW(),
    total_increased_amount = category_adjustment_history.total_increased_amount + 
      CASE WHEN p_adjustment_type = 'increase' THEN p_adjustment_amount ELSE 0 END,
    total_decreased_amount = category_adjustment_history.total_decreased_amount + 
      CASE WHEN p_adjustment_type = 'decrease' THEN p_adjustment_amount ELSE 0 END,
    updated_at = NOW();
END;
$$;

-- Function to cleanup old alert views
CREATE OR REPLACE FUNCTION cleanup_old_alert_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_alert_views
  WHERE viewed_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_alert_views() TO authenticated;

-- ============================================================================
-- 15. TRIGGERS
-- ============================================================================

-- Updated_at timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_households_timestamp
  BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_family_members_timestamp
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_categories_timestamp
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_transactions_timestamp
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_personal_budgets_timestamp
  BEFORE UPDATE ON personal_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_monthly_budgets_timestamp
  BEFORE UPDATE ON monthly_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_category_history_timestamp
  BEFORE UPDATE ON category_adjustment_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 16. AUTO-CREATE HOUSEHOLD FOR NEW USERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id UUID;
  user_first_name TEXT;
BEGIN
  -- Extract first name from user metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1),
    'My'
  );

  -- Create a personal household for the new user
  INSERT INTO public.households (name, created_by)
  VALUES (user_first_name || '''s Household', NEW.id)
  RETURNING id INTO new_household_id;

  -- Add the user as the owner of their household
  INSERT INTO public.household_members (household_id, user_id, role, invited_by)
  VALUES (new_household_id, NEW.id, 'owner', NEW.id);

  RETURN NEW;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================================================
-- 17. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE households IS 'Groups users together to share financial data';
COMMENT ON TABLE household_members IS 'Join table connecting users to households with roles';
COMMENT ON TABLE family_members IS 'Represents family members for expense tracking (not app users)';
COMMENT ON TABLE categories IS 'Budget categories with icons and colors';
COMMENT ON TABLE transactions IS 'Income and expense transactions';
COMMENT ON TABLE personal_budgets IS 'User baseline budget configurations (template for future months). global_settings includes currency, notifications, and showRoundedAmounts display preference.';
COMMENT ON TABLE monthly_budgets IS 'Active budget for each month with original_categories (baseline) and categories (current permanent state). Edit changes current month; Adjust schedules next month.';
COMMENT ON TABLE budget_adjustments IS 'Scheduled adjustments to be applied to personal_budgets on 1st of month, affecting future months';
COMMENT ON TABLE category_adjustment_history IS 'Tracks adjustment frequency per category for insights';
COMMENT ON TABLE user_alert_views IS 'Tracks which budget alerts users have viewed/dismissed';
COMMENT ON TABLE category_merge_history IS 'History of category merges';

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates household and membership for new users';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ OOGA DATABASE SCHEMA CREATED SUCCESSFULLY                  ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║                                                                   ║';
  RAISE NOTICE '║  Tables Created:                                                 ║';
  RAISE NOTICE '║    • households              • monthly_budgets                   ║';
  RAISE NOTICE '║    • household_members       • budget_adjustments                ║';
  RAISE NOTICE '║    • family_members          • category_adjustment_history       ║';
  RAISE NOTICE '║    • categories              • user_alert_views                  ║';
  RAISE NOTICE '║    • transactions            • category_merge_history            ║';
  RAISE NOTICE '║    • personal_budgets                                            ║';
  RAISE NOTICE '║                                                                   ║';
  RAISE NOTICE '║  Features Enabled:                                               ║';
  RAISE NOTICE '║    • Row Level Security on all tables                            ║';
  RAISE NOTICE '║    • Auto household creation for new users                       ║';
  RAISE NOTICE '║    • Updated_at triggers on all tables                           ║';
  RAISE NOTICE '║    • Security definer functions (no RLS recursion)               ║';
  RAISE NOTICE '║                                                                   ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;
