# Visa Cal Direct Integration

Documents the client-side authentication and transaction fetching flow for Visa Cal (cal-online.co.il). All calls are made directly from the browser — no server proxy required.

---

## Authentication Flow

### Step 1: Request OTP

```
PUT https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp
Content-Type: application/json

{
  "identifier": "<national_id>",
  "last4Digits": "<last_4_digits_of_card>",
  "sessionType": "SMS"
}
```

**Response**: `{ "SessionToken": "...", ... }`

Save the `SessionToken` — passed to Step 2.

Cal sends an SMS OTP to the user's registered phone number.

### Step 2: Verify OTP

```
POST https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp
Content-Type: application/json

{
  "identifier": "<national_id>",
  "sessionToken": "<SessionToken_from_step_1>",
  "otp": "<6_digit_SMS_code>"
}
```

**Response**: `{ "otpToken": "...", ... }`

Save the `otpToken` — used as a bearer token for all subsequent Cal API calls.

### Step 3: Discover Cards

```
POST https://api.cal-online.co.il/Authentication/api/account/init
Authorization: CALAuthScheme <otpToken>
Content-Type: application/json

{}
```

**Response**: `{ "result": { "cards": [...], "user": {...} } }`

Each card has:
- `cardUniqueId` — long internal ID used for transaction queries
- `last4Digits` — display value (e.g. `"2532"`)
- `cardOwnerFullName`, `isDebitCard`, `cardType`, etc.

---

## Transaction Fetching

### Pending Transactions (getClearanceRequests)

Returns transactions that have been authorized but not yet posted to a billing cycle.

```
POST https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests
Authorization: CALAuthScheme <otpToken>
Content-Type: application/json

{
  "cardUniqueId": "<cardUniqueId>"
}
```

**Response**: `{ "result": { "clearanceList": [...] } }`

Each pending transaction has: `trnAmt`, `trnPurchaseDate`, `trnDescription`, `merchantName`, `isInternational`, `numberOfPayments`.

### Completed Transactions (getCardTransactionsDetails)

Returns settled (billed) transactions for a given billing cycle.

```
POST https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails
Authorization: CALAuthScheme <otpToken>
Content-Type: application/json

{
  "cardUniqueId": "<cardUniqueId>",
  "month": "05",
  "year": "2026"
}
```

**Critical**: `month` **must be a zero-padded string** (e.g. `"05"` not `5`). Sending a number causes HTTP 400.

**Response**:
```json
{
  "result": {
    "bankAccounts": [
      {
        "debitDates": [
          {
            "txnIsrael": [ { /* transaction */ }, ... ],
            "txnAbroad": [ { /* transaction */ }, ... ]
          }
        ]
      }
    ]
  }
}
```

Each completed transaction has: `trnPurchaseDate`, `debCrdDate`, `trnAmt`, `chargedAmount`, `trnDescription`, `merchantName`, `trnType`, `numberOfPayments`, `numberOfPaymentsLeft`.

---

## Billing Cycle vs. Calendar Month

Cal's billing cycle does **not** match the calendar month:

- Cycle N covers approximately **month N-1 day 3** through **month N day 2**
- Example: requesting `month=05, year=2026` returns transactions from approximately April 3 – May 2
- A transaction purchased on May 5 appears in the **June** billing cycle (`month=06`)

### Fetching by Calendar Range

To get transactions for a calendar period (e.g. "May 2026"):
1. Request billing cycles M-1, M, and M+1 (e.g. months 4, 5, 6)
2. Post-filter by `trnPurchaseDate` using the desired calendar range (e.g. >= 2026-05-01)

This is implemented in `calDirectService.ts` → `computeFetchPlan()`.

---

## Data Normalization

**Date priority** (use first non-null):
1. `trnPurchaseDate` — actual purchase date (preferred)
2. `debCrdDate` — billing/debit date (last resort; use only if no purchase date)

**Amount**:
- Use `chargedAmount` as the primary amount (ILS settled value)
- If transaction is in a foreign currency, `chargedAmount` is still the ILS equivalent
- Store `trnAmt` as `original_amount` + `trnCurrency` as `original_currency` when different from ILS

**Refund detection** (transaction type = `income`):
- `trnType` contains `זיכוי` or `החזר` (Hebrew for "credit" / "refund")
- `trnType` contains `credit` or `refund` (English variants)
- `chargedAmount` is negative

**Installments**:
- `numberOfPayments > 1` indicates installment purchase
- `numberOfPaymentsLeft` can be used to compute current installment number

---

## WAF and CORS Notes

### connect.cal-online.co.il (OTP endpoints)
- Protected by BIG-IP WAF / F5 bot detection
- Datacenter IPs are blocked (this is why a server relay didn't work reliably)
- **Browser requests from residential/mobile IPs work fine** — Cal's own web SPA uses these same endpoints
- The browser handles the TS cookie challenge natively on first visit to cal-online.co.il

### api.cal-online.co.il (cards + transactions)
- Reflects any CORS `Origin` header — browser callable from any domain
- No WAF blocking observed for transaction/card endpoints

---

## Why GetSSOForIvr Doesn't Work

Cal has a `GetSSOForIvr` endpoint that was explored as an alternative authentication path. It always returns `statusCode: 96`, which indicates an IVR (phone system) authentication flow. This endpoint is not suitable for web/browser authentication. The `otpToken` from the standard OTP flow should be used directly as the `Authorization: CALAuthScheme <token>` header.

---

## Deduplication

Each imported transaction is assigned a `dedupe_hash` (SHA-256) computed from:
```
date + amount + description + cardUniqueId + installmentNumber
```

Before inserting, the hash is checked against existing transactions. Duplicates are skipped (counted as `skipped` in the import result).

---

## Implementation Files

| File | Role |
|------|------|
| `src/services/calDirectService.ts` | All Cal API calls, normalization, deduplication, Supabase push |
| `src/services/bankImportService.ts` | Wraps calDirectService; manages bank_connections via Supabase |
| `src/components/BankImportModal.tsx` | UI flow: confirm → OTP → importing → review |
| `src/components/ImportReviewStep.tsx` | Review table with category picker and accept/cancel |

---

## Known Limitations

- **Session duration**: The `otpToken` appears to expire after some time (exact duration unknown). If import takes very long, the token may become invalid mid-import.
- **Multiple cards**: The app fetches transactions for all cards on the account simultaneously. Each card has its own `cardUniqueId`.
- **Pending transactions**: Always fetched regardless of period selection. Their dates are filtered the same way as completed transactions.
