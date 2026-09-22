# Quick Start - Installments Feature

## Step 1: Run Database Migration ⚠️

**MUST BE DONE FIRST!**

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy-paste the SQL below:

```sql
-- ============================================================================
-- ADD INSTALLMENTS FEATURE
-- ============================================================================

-- Add installment columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS installment_group_id UUID,
ADD COLUMN IF NOT EXISTS installment_number INT,
ADD COLUMN IF NOT EXISTS installment_total INT;

-- Create index for installment queries
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group 
  ON transactions(installment_group_id) 
  WHERE installment_group_id IS NOT NULL;

-- Add check constraint to ensure installment data is consistent
ALTER TABLE transactions
ADD CONSTRAINT check_installment_consistency 
  CHECK (
    (installment_group_id IS NULL AND installment_number IS NULL AND installment_total IS NULL)
    OR
    (installment_group_id IS NOT NULL AND installment_number IS NOT NULL AND installment_total IS NOT NULL)
  );

-- Add comment explaining the installment fields
COMMENT ON COLUMN transactions.installment_group_id IS 'UUID linking all transactions in an installment series';
COMMENT ON COLUMN transactions.installment_number IS 'Current installment number (1-based index)';
COMMENT ON COLUMN transactions.installment_total IS 'Total number of installments in the series';
```

6. Click **Run** (or press `Ctrl+Enter`)
7. Verify "Success. No rows returned"

---

## Step 2: Test the Feature

### Create Test Installment

1. Open your app (dev or prod)
2. Click **Add Transaction**
3. Fill in:
   - Amount: `100`
   - Category: `Subscriptions`
   - Description: `Test Subscription`
4. Check **"Create as installments"**
5. Enter `3` installments
6. Click **Submit**

### Verify Creation

1. Check transaction list
2. Should see 3 transactions:
   - `Test Subscription [1/3]` - the date you picked
   - `Test Subscription [2/3]` - 1st of next month
   - `Test Subscription [3/3]` - 1st of month after

### Test Deletion

1. Click on `Test Subscription [2/3]`
2. Click **Delete**
3. Choose deletion option:
   - **Delete only this** - Removes just [2/3]
   - **Delete this and future** - Removes [2/3] and [3/3]
   - **Delete entire series** - Removes all 3
4. Click **Confirm Delete**

---

## Step 3: Real Usage

### Example: Netflix Annual Subscription (12 months)

1. Add Transaction
2. Amount: `191.88` (total annual cost)
3. Category: `Entertainment`
4. Description: `Netflix Subscription`
5. Check installments
6. Enter `12`
7. Submit

**Result:** 12 transactions of $15.99 each, one per month for the next year.

### Example: Car Purchase (36 months)

1. Add Transaction
2. Amount: `16200` (total car cost)
3. Category: `Transportation`
4. Description: `Car Payment`
5. Check installments
6. Enter `36`
7. Submit

**Result:** 36 transactions of $450 each, one per month for 3 years.

---

## Common Issues

### "Column does not exist"
❌ You didn't run the migration  
✅ Go back to Step 1

### "Please fill in Number of Installments"
❌ You checked the box but didn't enter a number  
✅ Enter a number between 2-36

### Installments not showing
❌ Possible data sync issue  
✅ Refresh the page or re-login

### Can't see delete options
❌ Opening wrong modal  
✅ Click on the installment transaction to edit it first

---

## Quick Reference

**Minimum installments:** 2  
**Maximum installments:** 36  
**Date used:** original date for the first installment, 1st of each month after  
**Description format:** `<Original> [n/total]`  
**UUID generation:** Automatic  
**Deletion options:** Single, Future, All  

---

## Need Help?

1. Check browser console (F12) for errors
2. Verify migration succeeded in Supabase SQL Editor
3. Try with 2-installment series first
4. See `docs/INSTALLMENTS_FEATURE.md` for full documentation
