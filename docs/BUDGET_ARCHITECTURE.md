# Budget Architecture - Complete Specification

**Version:** 2.0  
**Last Updated:** December 1, 2025  
**Status:** ✅ **Validated and Implemented**

---

## 🎯 Executive Summary

Ooga implements a **two-state budget system** where each month has:
1. **Original Budget** - Immutable baseline snapshot at month creation
2. **Current Budget** - Permanent editable state for that specific month

This enables both **historical accuracy** (what was originally planned) and **budget flexibility** (adjusting plans without losing history).

---

## 📊 Core Architectural Requirements

### ✅ Requirement 1: Each Month Has Its OWN Baseline Budget ("Original Budget")

**Implementation:**
- Field: `monthly_budgets.original_categories` (JSONB)
- Set once at month creation from `personal_budgets.categories`
- **Never modified** after creation
- Represents the initial plan at the start of the month

**Code Location:**
```typescript
// src/services/monthlyBudgetService.ts
original_categories: personalBudget.categories // Month-start snapshot (never modified)
```

---

### ✅ Requirement 2: Each Month Has Its OWN Modified Budget ("Current Budget")

**Implementation:**
- Field: `monthly_budgets.categories` (JSONB)
- Starts as copy of Personal Budget at month creation
- **Can be edited** via `updateCategoryLimit()`
- Represents the permanent budget state for that month

**Code Location:**
```typescript
// src/services/monthlyBudgetService.ts
categories: personalBudget.categories // Current state (starts as copy of personal)
```

---

### ✅ Requirement 3: Budgets Can Be Modified in Two Ways

#### (1) **Adjust** - Affects FOLLOWING Month's "Original Budget"

**What it does:**
- Schedules a change to the **Personal Budget** (template)
- Applied on the 1st of next month via `applyScheduledAdjustments()`
- Affects **future months' `original_categories`**
- Does NOT touch current or past months

**Implementation:**
- Table: `budget_adjustments`
- Service: `BudgetAdjustmentService.scheduleAdjustment()`
- Auto-apply: `useAutoApplyScheduledAdjustments()` hook

**Code Flow:**
1. User schedules adjustment for next month
2. Record stored in `budget_adjustments` table
3. On 1st of month, `applyScheduledAdjustments()` runs:
   - Updates `personal_budgets.categories`
   - Deletes monthly budget to force recreation with new baseline
4. New month's `original_categories` reflects the adjustment

#### (2) **Edit** - Permanent Change to Current Month

**What it does:**
- Updates `monthly_budgets.categories` **permanently**
- Changes budget for **this specific month only**
- Does NOT affect `original_categories` (baseline preserved)
- Does NOT affect Personal Budget (template unchanged)

**Implementation:**
- Service: `MonthlyBudgetService.updateCategoryLimit()`
- Hook: `useUpdateCategoryLimit()`

**Code Flow:**
1. User edits category limit in current month
2. Only `categories` field updated (NOT `original_categories`)
3. `adjustment_count` incremented
4. Change is **permanent** for that month

**Critical Distinction:**
```typescript
// ❌ INCORRECT (old terminology)
"Mid-month adjustment" // Implies temporary

// ✅ CORRECT (current terminology)  
"Edit: Permanent change to this month's budget"
"Adjust: Schedule change for next month's baseline"
```

---

### ✅ Requirement 4: Property Changes - On-the-Fly vs Historical Impact

#### **Color & Warning Threshold** - On-the-Fly ✅

**Implementation:**
- Changed via `useUpdateCategory()`
- Syncs to `personal_budgets.categories` JSONB
- Does NOT affect historical transaction data
- Updates apply to future UI rendering only

**Code:**
```typescript
// src/hooks/useCategories.ts - useUpdateCategory()
if (input.color !== undefined) budgetUpdates.color = input.color;
if (input.warningThreshold !== undefined) budgetUpdates.warningThreshold = input.warningThreshold;
await PersonalBudgetService.updateCategoryInAllBudgets(nameToUpdate, budgetUpdates);
```

#### **Category Name** - Historical Impact ⚠️

**Implementation:**
- Renamed via `useRenameCategory()`
- Updates:
  - Categories table
  - All monthly budgets (`categories` AND `original_categories`)
  - All personal budgets
  - **All transactions** (category string column)

**Impact:**
- Historical transactions show NEW name (not preserved)
- Historical analytics reflect renamed category
- **Not truly "on-the-fly"** - propagates through history

**Code:**
```typescript
// src/hooks/useCategories.ts - useRenameCategory()
await MonthlyBudgetService.renameCategoryInAllBudgets(oldName, newName);
await PersonalBudgetService.renameCategoryInAllBudgets(oldName, newName);
await PersonalBudgetService.renameCategoryInTransactions(oldName, newName);
```

---

### ✅ Requirement 5: Insights Access Both "Original Budget" and "Current Budget"

**Implementation:**
- Component: `BudgetVsActual.tsx`
- Accesses both fields for each monthly budget:
  - `mb.original_categories` → Original Budget
  - `mb.categories` → Current Budget
- Displays three values per category:
  - Original (planned)
  - Current (edited)
  - Actual (spent)

**Code:**
```typescript
// src/components/analytics/BudgetVsActual.tsx
const originalConfig = mb.original_categories?.[categoryName];
const monthlyConfig = mb.categories[categoryName];
```

---

### ✅ Requirement 6: Insights Show AVERAGE of Budgets Across Date Ranges

**Implementation:**
- **Calculates averages** (not sums) for multi-month periods
- **Skips empty months** (zero budget) to avoid inactivity skewing
- Displays "Avg Original Budget" and "Avg Current Budget"

**Algorithm:**
```typescript
// For each category:
monthlyBudgets.forEach(mb => {
  const originalLimit = mb.original_categories?.[categoryName]?.monthlyLimit || 0;
  if (originalLimit > 0) {
    originalSum += originalLimit;
    monthsWithOriginal++;
  }
});

const originalBudget = monthsWithOriginal > 0 
  ? originalSum / monthsWithOriginal  // AVERAGE
  : 0;
```

**UI Labels:**
- "Avg Original Budget" - Average planned at month start
- "Avg Current Budget" - Average including edits
- "Total Spending" - Sum of actual expenses
- Utilization: `(totalSpending / avgCurrentBudget) * 100`

---

## 🗂️ Database Schema

### `monthly_budgets` Table

```sql
CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  
  -- Two-state budget system:
  categories JSONB NOT NULL,           -- Current permanent state (editable)
  original_categories JSONB NOT NULL,  -- Month-start baseline (immutable)
  
  adjustment_count INT DEFAULT 0,      -- Number of edits made
  is_locked BOOLEAN DEFAULT false,     -- Prevent further changes
  
  CONSTRAINT unique_household_year_month UNIQUE(household_id, year, month)
);
```

**Field Descriptions:**
- `categories`: Permanent budget for this month (can be edited via `updateCategoryLimit()`)
- `original_categories`: Baseline snapshot (set once, never modified)
- `adjustment_count`: Tracks number of edits (NOT adjustments)

---

## 🔄 Operational Flows

### Flow 1: Month Creation

```
1. User navigates to new month
2. System checks: monthly budget exists?
   ❌ No → Create from Personal Budget
3. MonthlyBudgetService.createMonthlyBudget()
   - categories ← personalBudget.categories
   - original_categories ← personalBudget.categories (SNAPSHOT)
4. Both fields start identical
```

### Flow 2: Edit Current Month

```
1. User clicks "Edit" on category in current month
2. CategoryEditModal → Edit tab → Change limit
3. MonthlyBudgetService.updateCategoryLimit()
   - Updates categories[categoryName].monthlyLimit
   - Does NOT touch original_categories
   - Increments adjustment_count
4. Change is PERMANENT for this month
```

### Flow 3: Schedule Adjustment for Next Month

```
1. User clicks "Adjust" on category
2. CategoryEditModal → Adjustment tab → Set new limit
3. BudgetAdjustmentService.scheduleAdjustment()
   - Creates record in budget_adjustments table
   - effective_year/month = next month
4. On 1st of next month:
   - applyScheduledAdjustments() runs
   - Updates personal_budgets.categories
   - Deletes next month's monthly_budget (forces recreation)
5. Next month's original_categories reflects new baseline
```

---

## 🎨 UI Terminology

### Current User-Facing Labels

| Concept | UI Label | Technical Name | Location |
|---------|----------|----------------|----------|
| Baseline snapshot | "Original Budget" | `original_categories` | Insights, BudgetVsActual |
| Editable state | "Current Budget" | `categories` | Insights, BudgetVsActual |
| Change this month | "Edit" | `updateCategoryLimit()` | CategoryEditModal |
| Change next month | "Adjust" | `scheduleAdjustment()` | CategoryEditModal |

### Legacy Terminology (Historical Reference Only)

❌ **Deprecated Terms** (do not use):
- "Mid-month adjustment" (implies temporary)
- "Temporary change" (edits are permanent)
- "This month only" (misleading - changes are permanent for that month)

✅ **Current Terms**:
- "Edit: Permanent change to this month's budget"
- "Adjust: Schedule change for next month's baseline"

---

## 📈 Analytics Behavior

### Budget vs Actual Component

**Display Logic:**
- **Single Month:** Shows exact values for that month
- **Multiple Months:** Shows **AVERAGES** across months
  - Original Budget: Average of `original_categories` (skips zeros)
  - Current Budget: Average of `categories` (skips zeros)
  - Actual Spending: **Sum** of transactions (not average)

**Empty Month Handling:**
- Months with zero budget are **excluded** from average calculation
- Prevents inactive months from skewing results
- Example: 3 months [500, 0, 600] → Average = (500+600)/2 = 550, not 366.67

---

## 🔍 Validation Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| 1. Original Budget per month | ✅ | `original_categories` field |
| 2. Current Budget per month | ✅ | `categories` field |
| 3a. Adjust affects next month | ✅ | `applyScheduledAdjustments()` |
| 3b. Edit is permanent for month | ✅ | `updateCategoryLimit()` |
| 4. Color/threshold on-the-fly | ✅ | Syncs to personal budgets only |
| 4. Name propagates historically | ⚠️ | Renames transactions (not preserved) |
| 5. Insights access both | ✅ | `BudgetVsActual` component |
| 6. Insights show averages | ✅ | Divides by monthsWithBudget |

---

## 🚀 Migration Notes

**December 1, 2025 Updates:**
1. ✅ Fixed terminology: Removed "mid-month temporary" references
2. ✅ Corrected comments: Edits are permanent, not temporary
3. ✅ Updated BudgetVsActual: Changed from sums to averages
4. ✅ Empty month handling: Skip zero-budget months in calculations
5. ✅ Documentation: Comprehensive architecture specification
6. ✅ Schema comments: Added legacy naming for historical reference

**Backward Compatibility:**
- Existing data unchanged
- UI labels updated for clarity
- Analytics now show averages (more intuitive for multi-month views)
- Legacy terminology preserved in documentation for reference

---

## 📚 Related Documentation

- `/docs/MONTHLY_BUDGET_HISTORY_GUIDE.md` - Quick start guide
- `/docs/COMPLETE_FEATURE_SUMMARY.md` - Feature overview
- `/supabase/migrations/UNIFIED_SCHEMA.sql` - Database schema with comments
- `/src/services/monthlyBudgetService.ts` - Core budget logic
- `/src/components/analytics/BudgetVsActual.tsx` - Analytics implementation

---

## 📞 Key Contacts

**Architecture Validation:** Completed December 1, 2025  
**Next Review:** Quarterly or on major feature changes
