# Default Budget Values Documentation

## Overview
When a user creates a fresh budget in Ooga, default values are applied for categories, limits, and settings.

## Location of Default Values

### File: `src/components/PersonalBudgetEditor.tsx`
**Lines: 105-115**

```typescript
// Use defaults if no active budget exists
setCurrency('ILS');
setWarningNotifications(true);
setEmailAlerts(false);
setCategories({
  'Groceries': { monthlyLimit: 1500, warningThreshold: 80, isActive: true },
  'Transportation': { monthlyLimit: 600, warningThreshold: 80, isActive: true },
  'Entertainment': { monthlyLimit: 400, warningThreshold: 80, isActive: true },
  'Bills & Utilities': { monthlyLimit: 1000, warningThreshold: 80, isActive: true },
  'Home & Garden': { monthlyLimit: 300, warningThreshold: 80, isActive: true },
});
```

## Default Values Breakdown

### Global Settings
- **Currency**: `'ILS'` (Israeli Shekel)
- **Warning Notifications**: `true` (enabled by default)
- **Email Alerts**: `false` (disabled by default)

### Default Categories

| Category | Monthly Limit | Warning Threshold | Active |
|----------|--------------|-------------------|--------|
| Groceries | 1,500 ILS | 80% | ✅ |
| Transportation | 600 ILS | 80% | ✅ |
| Entertainment | 400 ILS | 80% | ✅ |
| Bills & Utilities | 1,000 ILS | 80% | ✅ |
| Home & Garden | 300 ILS | 80% | ✅ |

**Total Default Budget**: 3,800 ILS/month

### Category Settings
Each category has:
- `monthlyLimit`: Amount in base currency
- `warningThreshold`: Percentage (0-100) at which warnings trigger
- `isActive`: Whether the category is currently being tracked

## Reset to Default State

### New Feature: Reset Budget Configuration

**Purpose**: Allows users to completely reset their budget configuration back to the default state (as if they just created their account).

### Service Function
**File**: `src/services/personalBudgetService.ts`
**Function**: `resetAllBudgets(options?)`

```typescript
static async resetAllBudgets(options?: {
  includeMonthlyBudgets?: boolean;
  includeTransactions?: boolean;
}): Promise<{
  budgetsDeleted: number;
  monthlyBudgetsDeleted?: number;
  transactionsDeleted?: number;
}>
```

### Options

1. **Default** (no options): Deletes only personal budgets
   - Removes all budget configurations
   - Keeps monthly budgets and transactions

2. **includeMonthlyBudgets**: Also delete monthly budget snapshots
   - Removes historical budget data for each month
   - Useful for a complete budget reset

3. **includeTransactions**: Also delete all transactions
   - **DANGER**: Removes all transaction history
   - Complete data wipe, returns to fresh state

### UI Implementation

**Component**: `PersonalBudgetEditor.tsx`
**Button**: "Reset All" (red button, appears when budgets exist)

**User Flow**:
1. Click "Reset All" button
2. Confirm main action (deletes all personal budgets)
3. Optionally choose to delete monthly budgets
4. Optionally choose to delete transactions
5. Success message shows what was deleted
6. User can create fresh budget

### Hook
**File**: `src/hooks/useBudgets.ts`
**Hook**: `useResetAllBudgets()`

```typescript
const resetAllBudgets = useResetAllBudgets();

// Usage
await resetAllBudgets.mutateAsync({
  includeMonthlyBudgets: true,
  includeTransactions: false,
});
```

## Related Files

### Budget Template (Reference)
**File**: `src/config/budgetTemplate.ts`
- Contains the full budget template with all available categories
- Used as inspiration but NOT directly loaded as defaults
- Includes family member budgets, income targets, savings goals, etc.

### Types
**File**: `src/types/budget.ts`
- `PersonalBudget` - User's baseline budget configuration
- `CategoryConfig` - Individual category settings
- `GlobalBudgetSettings` - Application-wide preferences

### Services
- `src/services/personalBudgetService.ts` - Manages personal budgets
- `src/services/monthlyBudgetService.ts` - Manages monthly budget instances
- `src/services/budgetAdjustmentService.ts` - Handles adjustments

## Modifying Default Values

To change the default values:

1. **Edit**: `src/components/PersonalBudgetEditor.tsx`
2. **Locate**: `handleStartCreate` function (around line 95)
3. **Modify**: The `setCategories()` call with your desired defaults
4. **Update**: Currency and notification settings if needed

```typescript
// Example: Change to USD with different categories
setCurrency('USD');
setCategories({
  'Rent': { monthlyLimit: 1500, warningThreshold: 90, isActive: true },
  'Food': { monthlyLimit: 800, warningThreshold: 80, isActive: true },
  'Shopping': { monthlyLimit: 500, warningThreshold: 75, isActive: true },
});
```

## Testing Reset Functionality

**Dev Tools Page**: `src/pages/DevTools.tsx`
- Includes "Clear Dummy Data" button (clears current year's dummy data)
- New "Reset All Budgets" functionality available in Budget Management page

## Security & Safeguards

1. **Multiple Confirmations**: Users must confirm multiple times
2. **Clear Warnings**: Explicit about what will be deleted
3. **Granular Control**: Option to choose what to delete
4. **Cannot Undo**: Users are warned this is permanent
5. **RLS Protection**: Row Level Security ensures users only delete their own data

## Impact on Other Features

After reset:
- ✅ **Household**: Remains intact (not deleted)
- ✅ **Family Members**: Remain intact (not deleted)
- ✅ **Settings/Tags**: Remain intact
- ❌ **Personal Budgets**: All deleted
- ⚠️ **Monthly Budgets**: Optional (user choice)
- ⚠️ **Transactions**: Optional (user choice)

## Migration Notes

The default values were introduced during the migration from the old budget system:
- Old system: `budget_configs` table with categories stored separately
- New system: `personal_budgets` with embedded category configuration
- Migration: `002_budget_adjustment_system.sql`
