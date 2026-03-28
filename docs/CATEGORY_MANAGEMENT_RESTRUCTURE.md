# Category Management & App Restructure Plan

## Overview

This document outlines a major restructure of the Ooga application to:
1. Introduce proper category management with ID-based categories
2. Reorganize navigation and component hierarchy
3. Enable category operations: rename, merge, split, delete, add

---

## Current State Analysis

### Navigation Structure (Current)
```
App
├── Dashboard (/)
│   ├── Month Navigator Carousel
│   ├── Budget Overview Cards
│   ├── Alerts
│   ├── Transaction History
│   └── Household Management (in header/settings area)
│
├── Budget Management (/budget)
│   ├── Tab: My Budget
│   │   ├── Budget Overview (spending cards)
│   │   ├── Category List with limits
│   │   ├── Edit Budget Modal
│   │   │   ├── Category Management (add/edit/delete)
│   │   │   └── Global Settings
│   │   └── Budget History
│   │
│   ├── Tab: Analytics
│   │   ├── Date Range Filter
│   │   ├── Budget vs Actual Chart
│   │   └── Category Accuracy Chart
│   │
│   └── Tab: Adjustments
│       └── Monthly budget adjustments
│
├── Transactions (/transactions)
│   └── Full transaction list with filters
│
└── Profile/Settings
    └── User preferences
```

### Database Schema (Current)
```
transactions
├── id (UUID)
├── category (STRING) ← Problem: No referential integrity
├── ...

personal_budgets
├── id (UUID)
├── categories (JSONB) ← Keys are category names (strings)
│   └── { "Groceries": { monthlyLimit, color, ... } }
├── global_settings (JSONB)
│   └── activeExpenseCategories: string[] ← Category names

monthly_budgets
├── categories (JSONB) ← Keys are category names
├── original_categories (JSONB) ← Keys are category names

budget_adjustments
├── category_name (STRING) ← No foreign key
```

---

## Proposed State

### Navigation Structure (Proposed)
```
App
├── Dashboard (/)
│   ├── Month Navigator Carousel
│   ├── Budget Overview Cards
│   ├── Alerts
│   └── Transaction History
│
├── Budget (/budget)                    ← Renamed from "Budget Management"
│   ├── Tab: Overview                   ← Renamed from "My Budget"
│   │   ├── Budget Summary Cards
│   │   ├── Category Spending Overview (read-only)
│   │   └── Budget History (versions)
│   │
│   ├── Tab: Categories                 ← NEW (replaces Analytics position)
│   │   ├── Category List (with inline actions)
│   │   ├── Category Actions:
│   │   │   ├── Add Category
│   │   │   ├── Edit Category (modal - reuse existing)
│   │   │   ├── Rename Category
│   │   │   ├── Merge Categories
│   │   │   ├── Delete Category
│   │   │   └── Reorder Categories (drag & drop?)
│   │   └── Category Health Indicators
│   │
│   ├── Tab: Settings                   ← Renamed from "Global Settings" in modal
│   │   ├── Currency
│   │   ├── Notification Preferences
│   │   ├── Family Members (moved here)
│   │   └── Household Management (moved from Dashboard)
│   │
│   └── Tab: Adjustments               ← Keep as-is
│       └── Monthly budget adjustments
│
├── Insights (/insights)               ← NEW top-level, moved from Budget/Analytics
│   ├── Date Range Filter (shared)
│   ├── Budget vs Actual
│   ├── Category Accuracy (bullseye)
│   ├── Spending Trends (future)
│   └── Savings Goals (future)
│
├── Transactions (/transactions)
│   └── Full transaction list
│
└── Profile/Settings
    └── User preferences
```

---

## Database Migrations

### Migration 014: Create Categories Table
```sql
-- Create dedicated categories table with UUIDs
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  
  -- Category properties
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  description TEXT,
  icon TEXT,  -- Future: emoji or icon name
  
  -- Budget settings
  monthly_limit DECIMAL(12,2) DEFAULT 0,
  warning_threshold INTEGER DEFAULT 80,  -- Percentage
  
  -- State
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,  -- Tracks "was auto-generated" for analytics
  sort_order INTEGER DEFAULT 0,
  
  -- Soft-delete and merge tracking
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_reason TEXT,  -- 'merged', 'user_deleted', NULL if active
  merged_into_id UUID REFERENCES categories(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique names per user/household (only for non-deleted)
  UNIQUE NULLS NOT DISTINCT (user_id, household_id, name, deleted_at)
);

-- Indexes
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_household ON categories(household_id);
CREATE INDEX idx_categories_active ON categories(user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_deleted ON categories(user_id) WHERE deleted_at IS NOT NULL;

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Household members can view shared categories"
  ON categories FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.uid()
    )
  );
```

### Migration 015: Add Category ID to Transactions
```sql
-- Add category tracking columns
ALTER TABLE transactions 
ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
ADD COLUMN original_category_id UUID REFERENCES categories(id),
ADD COLUMN category_changed_at TIMESTAMPTZ,
ADD COLUMN category_change_reason TEXT;  -- 'merge', 'reassignment', 'user_edit'

-- Create indexes
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_original_category ON transactions(original_category_id) 
  WHERE original_category_id IS NOT NULL;

-- Note: Data migration happens in application code (Migration 016)
-- We keep the old 'category' column temporarily for safety

COMMENT ON COLUMN transactions.original_category_id IS 
  'Preserved when transaction category changes due to merge/reassignment';
COMMENT ON COLUMN transactions.category_changed_at IS 
  'Timestamp when category was changed (NULL if never changed)';
```

### Migration 016: Migrate Transaction Categories (Application-Assisted)
```sql
-- This migration is run AFTER application creates category records
-- It maps existing category names to new category IDs

-- Function to migrate categories for a user
CREATE OR REPLACE FUNCTION migrate_user_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Update transactions with matching category names
  UPDATE transactions t
  SET category_id = c.id
  FROM categories c
  WHERE t.user_id = p_user_id
    AND t.category = c.name
    AND c.user_id = p_user_id
    AND t.category_id IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### Migration 017: Update Budget Tables
```sql
-- Add category references to budget_adjustments
ALTER TABLE budget_adjustments 
ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- Migrate existing adjustments
-- (Application will handle this during migration process)

-- Note: personal_budgets.categories and monthly_budgets.categories
-- will be gradually deprecated as we move to the categories table
-- They remain for backward compatibility during migration period
```

### Migration 018: Category Merge History
```sql
-- Track category merges for audit trail
CREATE TABLE category_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Merge details
  source_category_id UUID NOT NULL,  -- Category that was merged FROM
  source_category_name TEXT NOT NULL,  -- Preserved name at time of merge
  target_category_id UUID NOT NULL REFERENCES categories(id),
  target_category_name TEXT NOT NULL,  -- Name at time of merge
  
  -- Statistics
  transactions_moved INTEGER DEFAULT 0,
  adjustments_moved INTEGER DEFAULT 0,
  
  -- Metadata
  merged_at TIMESTAMPTZ DEFAULT NOW(),
  merged_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE category_merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own merge history"
  ON category_merge_history FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Implementation Phases

### Phase 1: Database Foundation ✅ COMPLETE
- [x] Create Migration 014 (categories table)
- [x] Create Migration 015 (add category_id to transactions)
- [x] Create Migration 016 (add category_id to budgets)
- [x] Create Migration 017 (category migration utilities)
- [x] Create Migration 018 (category merge history)
- [x] Create category types (`src/types/category.ts`)
- [x] Create category service with CRUD operations (`src/services/categoryService.ts`)

**Deliverables:**
- ✅ New `categories` table with soft-delete and merge tracking
- ✅ `category_merge_history` table for audit trail
- ✅ `categoryService.ts` with CRUD, merge, and migration operations
- ✅ Database functions: `migrate_user_categories()`, `merge_categories()`, `undo_category_merge()`

**Files Created:**
- `supabase/migrations/014_create_categories_table.sql`
- `supabase/migrations/015_add_category_id_to_transactions.sql`
- `supabase/migrations/016_add_category_id_to_budgets.sql`
- `supabase/migrations/017_category_migration_utilities.sql`
- `supabase/migrations/018_category_merge_history.sql`
- `src/types/category.ts`
- `src/services/categoryService.ts`

---

### Phase 2: Dual-Write Period ✅ COMPLETE
- [x] Update transaction creation to write both `category` and `category_id`
- [x] Update transaction update to write both `category` and `category_id`
- [x] Historical data already migrated (218 transactions)

**Deliverables:**
- ✅ `addTransaction()` now includes `category_id` lookup
- ✅ `updateTransaction()` now includes `category_id` lookup
- ✅ All existing transactions have `category_id` set

**Files Modified:**
- `src/services/supabaseDataService.ts` - Added `getCategoryId()` helper, updated `addTransaction()` and `updateTransaction()`

---

### Phase 3: Navigation Restructure ✅ COMPLETE
- [x] Add Insights tab to top-level navigation
- [x] Move Analytics to standalone Insights tab
- [x] Rename "My Budget" to "Overview"
- [x] Create placeholder "Categories" tab
- [ ] Move Household Management to Budget Settings (deferred)

**Deliverables:**
- ✅ New "Insights" tab with Budget vs Actual and Category Accuracy
- ✅ Budget Management tabs: Overview, Categories, Adjustments
- ✅ Categories tab with placeholder UI and stats
- ✅ All existing functionality preserved

**Files Created:**
- `src/pages/InsightsPage.tsx` - Standalone analytics page

**Files Modified:**
- `src/components/dashboard/DashboardTabNavigation.tsx` - Added Insights tab
- `src/components/Dashboard.tsx` - Handle insights tab, import InsightsPage
- `src/pages/BudgetManagement.tsx` - Renamed tabs, added Categories placeholder

---

### Phase 4: Category Management UI ✅ COMPLETE
- [x] Create CategoryList component
- [x] Implement Add Category (reuse modal)
- [x] Implement Edit Category (reuse modal)
- [x] Implement Rename Category (with preview)
- [x] Implement Delete Category (with reassignment option)
- [x] Implement Merge Categories wizard
- [x] Implement Edit Limit modal
- [x] Migration 019: Add category type column
- [x] Migration 020: Cleanup duplicate categories

**Deliverables:**
- ✅ Full category management in Categories tab
- ✅ All category operations functional (add, rename, delete, merge, edit limit)
- ✅ Category type support (expense/income)
- ✅ Duplicate category cleanup

**Files Created:**
- `src/components/categories/CategoryList.tsx`
- `src/components/categories/AddCategoryModal.tsx`
- `src/components/categories/RenameCategoryModal.tsx`
- `src/components/categories/DeleteCategoryModal.tsx`
- `src/components/categories/MergeCategoryModal.tsx`
- `src/components/categories/EditLimitModal.tsx`
- `src/components/categories/index.ts`
- `src/hooks/useCategories.ts`
- `supabase/migrations/019_add_category_type.sql`
- `supabase/migrations/020_cleanup_duplicate_categories.sql`

---

### Phase 5: Budget Settings Consolidation ✅ COMPLETE
- [x] Create BudgetSettings component
- [x] Add Settings tab to Budget Management
- [x] Move Global Settings (currency, notifications) to Settings tab
- [x] Integrate Household Management into Settings tab
- [x] Simplify PersonalBudgetEditor (remove global settings UI)

**Deliverables:**
- ✅ Settings tab complete with collapsible sections
- ✅ Currency, notifications, and household management consolidated
- ✅ PersonalBudgetEditor simplified (focuses on categories only)
- ✅ Clean separation of concerns

**Files Created:**
- `src/components/settings/BudgetSettings.tsx`
- `src/components/settings/index.ts`

**Files Modified:**
- `src/pages/BudgetManagement.tsx` - Added Settings tab
- `src/components/PersonalBudgetEditor.tsx` - Removed global settings UI

---

### Phase 6: Cleanup & Deprecation
- [ ] Remove `category` string column from transactions (after validation)
- [ ] Update all queries to use category_id exclusively
- [ ] Remove redundant category data from personal_budgets.categories
- [ ] Update all services and hooks

**Deliverables:**
- Clean schema with no redundant data
- All code uses category_id
- Full backward compatibility removed

---

### Phase 7: Category Onboarding Questionnaire (Enhancement)
- [ ] Create questionnaire flow component
- [ ] Define question set and category mapping logic
- [ ] Integrate into first-time budget creation
- [ ] Add "Reset to suggested categories" option

**Deliverables:**
- Smart category suggestions for new users
- Reduced friction in initial setup
- Better default limits based on user situation

---

## Component Mapping

### Components to Modify

| Component | Current Location | Changes Needed |
|-----------|-----------------|----------------|
| `BudgetManagement.tsx` | `/pages` | Rename tabs, restructure |
| `PersonalBudgetEditor.tsx` | `/components` | Extract category management |
| `BudgetVsActual.tsx` | `/components/analytics` | Move to Insights page |
| `CategoryAccuracyChart.tsx` | `/components/analytics` | Move to Insights page |
| `DateRangeFilter.tsx` | `/components/analytics` | Move to shared location |

### New Components to Create

| Component | Purpose |
|-----------|---------|
| `InsightsPage.tsx` | New top-level page for analytics |
| `CategoryManagement.tsx` | Main category management container |
| `CategoryList.tsx` | List of categories with actions |
| `CategoryMergeWizard.tsx` | Multi-step merge flow |
| `CategoryRenameModal.tsx` | Rename with preview |
| `BudgetSettings.tsx` | Settings tab content |

### Components to Reuse

| Component | Current Use | New Use |
|-----------|-------------|---------|
| Edit Category Modal | In PersonalBudgetEditor | In CategoryManagement |
| Family Member Editor | In PersonalBudgetEditor | In BudgetSettings |
| Household Management | Dashboard header | BudgetSettings tab |

---

## Category Operations Specification

### Rename Category
**User Flow:**
1. User clicks "Rename" on category
2. Modal shows: Current name, New name input
3. Preview shows: "X transactions will be updated"
4. User confirms
5. System updates: category.name only (IDs unchanged)

**Technical:**
- Single UPDATE on categories table
- No transaction updates needed (they reference ID)
- Instant operation

---

### Merge Categories
**User Flow:**
1. User clicks "Merge" on category A
2. Modal shows: Select target category B
3. Preview shows: 
   - "X transactions from A → B"
   - "A's budget ($X) will be added to B's ($Y) = $Z"
4. User confirms
5. System:
   - Updates all transactions: category_id = B
   - Updates budget limits
   - Records in merge_history
   - Deletes category A

**Technical:**
- UPDATE transactions SET category_id = B WHERE category_id = A
- UPDATE budget_adjustments similarly
- INSERT into category_merge_history
- DELETE from categories WHERE id = A

---

### Delete Category
**User Flow:**
1. User clicks "Delete" on category
2. If category has transactions:
   - "This category has X transactions. Reassign to:" [dropdown]
3. If category has no transactions:
   - "Delete category permanently?"
4. User confirms

**Technical:**
- If reassigning: UPDATE transactions first
- Then DELETE from categories

---

### Add Category
**User Flow:**
1. User clicks "Add Category"
2. Modal (reuse existing): Name, Color, Limit, Threshold
3. User saves
4. Category appears in list

**Technical:**
- INSERT into categories
- No transaction updates

---

## Risk Mitigation

### Data Integrity
- Keep old `category` column during migration
- Validate category_id matches category name before dropping column
- Create backup before Phase 6

### User Experience
- No breaking changes until Phase 6
- Dual-write ensures data consistency
- Gradual rollout possible

### Rollback Plan
- Each migration has rollback script
- Old code paths remain functional until Phase 6
- Can revert navigation changes independently

---

## Open Questions - RESOLVED

### 1. Household Categories
**Decision:** All categories are shared at household level (current behavior).
- Future consideration: Personal category overrides per household member
- Marked as out-of-scope for this restructure

### 2. Default Categories & Onboarding
**Decision:** Option C - Just Suggestions, with smart onboarding

**`is_system` flag usage:**
- Tracks "was auto-generated" for analytics purposes only
- NO UI distinction between system and user-created categories
- NO protection against deletion/modification

**New Feature: Category Questionnaire (Onboarding)**
When a new household creates their first budget:
1. Present a short questionnaire to understand their situation
2. Generate a suggested category set based on answers
3. User can accept, modify, or start from scratch

**Sample Questions:**
- "Do you rent or own your home?" → Rent/Mortgage category
- "Do you have a car?" → Transportation, Gas, Car Insurance
- "Do you have children?" → Childcare, Kids Activities
- "Do you have pets?" → Pet Care
- "Do you subscribe to streaming services?" → Subscriptions
- "How often do you eat out?" → Dining Out (with suggested limit)

**Implementation:** Phase 7 (Post-restructure enhancement)

### 3. Transaction Reassignment UI
**Decision:** Show affected transaction count + confirmation summary after operation.

### 4. Historical Data Preservation
**Decision:** NEVER lose historical data. Everything must be traceable.

**Key principles:**
- Deprecated categories are soft-deleted (hidden, not removed)
- Transactions retain `original_category_id` when merged
- Budget history remains intact with merge annotations
- Mid-month merges handled gracefully (see below)

**See:** "Historical Data Preservation Strategy" section below.

### 5. Budget Limits on Merge
**Decision:** Merged budgets = merged funds.
- When merging Category A ($100) into Category B ($200)
- Result: Category B becomes $300 limit
- Applied to current and future months
- Historical months remain unchanged

### 6. Category Accuracy After Merge
**Decision:** Show all category IDs that existed in the date range.
- Dropdown shows both current AND merged-from categories
- Accuracy calculated per original category for historical periods
- Post-merge periods show combined accuracy
- Details panel explains merge history if applicable

### 7. Transaction History Display
**Decision:** Show current category name, with "Previously categorized under" in details.

**List view:** "Healthcare & Beauty" (current name only)
**Detail view:** 
```
Category: Healthcare & Beauty
ℹ️ Previously categorized under: Healthcare (merged Nov 2025)
```

---

## Historical Data Preservation Strategy

### Core Principle
> No data is ever deleted. All changes are traceable. Users can understand their full financial history.

### Soft-Delete for Categories

```sql
-- Categories table additions
ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE categories ADD COLUMN deleted_reason TEXT;  -- 'merged', 'user_deleted'
ALTER TABLE categories ADD COLUMN merged_into_id UUID REFERENCES categories(id);
```

**Behavior:**
- "Deleted" categories have `deleted_at` set
- They don't appear in dropdowns for new transactions
- They DO appear in historical reports for their active period
- Merged categories have `merged_into_id` pointing to target

### Transaction Merge Tracking

```sql
-- Transactions table additions
ALTER TABLE transactions ADD COLUMN original_category_id UUID;
ALTER TABLE transactions ADD COLUMN category_changed_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN category_change_reason TEXT;  -- 'merge', 'reassignment'
```

**On merge:**
1. `original_category_id` = old category (preserved forever)
2. `category_id` = new target category
3. `category_changed_at` = timestamp of merge
4. `category_change_reason` = 'merge'

**Display logic:**
- List views: Show current `category_id` name
- Detail views: If `original_category_id` differs, show "Previously: X"

### Mid-Month Merge Handling

**Scenario:** User merges "Beauty" into "Healthcare" on November 15th.

**Current month (November) behavior:**

| Aspect | Before Nov 15 | After Nov 15 |
|--------|---------------|--------------|
| Beauty transactions | Show as "Beauty" | Show as "Healthcare & Beauty" |
| Beauty budget | $100 allocated | Merged into Healthcare |
| Healthcare budget | $200 | $300 (combined) |
| Monthly budget record | Has both categories | Beauty removed, Healthcare updated |

**Implementation:**
1. Update `monthly_budgets.categories` to combine limits
2. Store snapshot in `monthly_budgets.original_categories` if not already set
3. Record merge in `category_merge_history` with timestamp
4. All transactions updated immediately (category_id change)

**Budget vs Actual calculation:**
- For the merge month: Combine spending from both categories
- Show note: "Includes merged category data"

### Budget History Display

**Before merge (viewing October):**
```
Healthcare: $200 budget, $180 spent
Beauty: $100 budget, $75 spent
```

**After merge (viewing October):**
```
Healthcare & Beauty: $300 budget, $255 spent
  └─ Note: Includes data from "Beauty" (merged Nov 2025)
```

**OR (Alternative - more accurate):**
```
Healthcare & Beauty: $300 budget, $255 spent
  ├─ Healthcare (pre-merge): $180
  └─ Beauty (merged → Healthcare & Beauty): $75
```

**Decision needed:** Which display approach for historical months?
- **Simple:** Combined total with note
- **Detailed:** Breakdown showing original categories

### Category Accuracy Historical Handling

**Scenario:** Viewing accuracy for "Healthcare & Beauty" over last 6 months, but merge happened 2 months ago.

**Approach:**
1. For months BEFORE merge: Sum data from both original categories
2. For months AFTER merge: Use combined category data
3. Show indicator: "Data includes merged categories"

**Dropdown behavior:**
- Current categories: Always shown
- Deleted/merged categories: Shown only if they have data in selected range
- Merged categories show: "Beauty (merged into Healthcare & Beauty)"

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database | 1-2 days | None |
| Phase 2: Dual-Write | 2-3 days | Phase 1 |
| Phase 3: Navigation | 1-2 days | None (parallel with 1-2) |
| Phase 4: Category UI | 3-5 days | Phases 1, 2, 3 |
| Phase 5: Settings | 1-2 days | Phase 3 |
| Phase 6: Cleanup | 1-2 days | All above |
| Phase 7: Onboarding | 2-3 days | Phase 4 |

**Total: 11-19 days**

---

## Remaining Decision

### Historical Budget Display After Merge

When viewing a month BEFORE a merge occurred, how should we display it?

**Option A: Simple Combined**
```
Healthcare & Beauty: $300 budget, $255 spent
  └─ ℹ️ Includes data from "Beauty" (merged Nov 2025)
```

**Option B: Detailed Breakdown**
```
Healthcare & Beauty: $300 budget, $255 spent
  ├─ Healthcare (original): $200 budget, $180 spent
  └─ Beauty (merged): $100 budget, $75 spent
```

**Recommendation:** Option A for list views, Option B available in detail/drill-down views.

---

## Next Steps

1. Review this document
2. Answer open questions
3. Approve phases and timeline
4. Begin Phase 1: Database Foundation

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-26 | Copilot | Initial draft |
