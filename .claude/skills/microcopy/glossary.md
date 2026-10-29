# Ooga glossary

One term per concept. "Avoid" lists what older screens still say; replace it when you touch that string.
Terms marked **proposed** were inferred from the newest screens and haven't been confirmed by the owner yet. Use them, and if the owner decides otherwise, update this file.

## People and sharing

| Use | Means | Avoid | Notes |
|---|---|---|---|
| household | The shared space a family's budget, transactions and accounts belong to. Every user is in exactly one. | family account, group | `Household settings`, `Leave household` |
| owner | The participant who manages the household (invites, removes, transfers ownership). | admin | DB role `owner` |
| participant | Someone with an Ooga login in the household. **Proposed:** `Participant` in badges and lists (today: `Budget Participant`). | member, budget participant, user | DB role `participant` (renamed from member/admin in migration 010) |
| family member | Who a transaction is for, or who spent it: a label, optionally linked to a participant. Kids can be family members without a login. | tag, custom tag, household member tag | `Family member (optional)` on transaction forms |
| invitation code | The code a participant shares so someone can join the household. | invite link, join code | `Paste invitation code` |

## Money in and out

| Use | Means | Avoid | Notes |
|---|---|---|---|
| transaction | Any income or expense row. | entry, record | "manual entry" only when contrasting with imported rows |
| expense / income | The two transaction types. | debit / credit (bank jargon) | Filter labels: `Expenses`, `Income` |
| category | What a transaction is for. | tag, label | `Uncategorized` when none |
| installments | A purchase paid in several monthly payments (תשלומים). | payments plan | `Convert to installments`; a single row shows `installment 3/12` |
| Paid with / Received in | The connected account a manual transaction used. | Paid by, source | `Cash / not a connected account` for none |

## Budgets

| Use | Means | Avoid | Notes |
|---|---|---|---|
| budget | The household's plan: categories with monthly limits. | personal budget, template, configuration | "Personal budget" is the code's name for it, not the UI's |
| monthly limit | How much a category may spend in a month. | budget limit, max amount, cap | `Monthly limit` field label |
| warning threshold | The percentage of the limit at which Ooga warns. **Proposed** over the current mix. | alert at, warning at, budget alerts | Show as `Warns at 80%` |
| over budget | Spent more than the monthly limit. | exceeded, overspent | Badge: `Over budget` |
| adjustment | A change to one month's limit, now or scheduled for next month. | override, tweak | `Schedule for next month` |
| budget history / version | Earlier saved versions of the budget. | configurations | `Set as active` restores a version |
| exact amounts | The setting that shows decimals instead of rounded amounts. | rounded amounts, decimal precision | Off by default (rounded) |

## Accounts and import

| Use | Means | Avoid | Notes |
|---|---|---|---|
| connected account | A bank or credit card account Ooga can import from. | connection, bank connection, linked account | Settings section: `Connected accounts` |
| import | Pulling transactions from a connected account. | sync, scrape, fetch | `Import transactions`, `Cancel import` |
| duplicate | An imported row Ooga already has, so it's skipped. | dupe, conflict | `3 duplicates skipped` |
| merge (into an entry) | A bank row folded into the manual transaction it matches. | reconcile, link | Reversible: `Undo` |
| verification code | The one-time SMS code a bank sends. **Proposed** for UI text. | OTP | `Send code`, `Enter the code from your SMS` |

## Sign-in

| Use | Avoid |
|---|---|
| Sign in / Sign out | Log in, Login, Logout |
| Create account | Sign up, Register (the route stays `/register`) |
| Forgot your password? | Reset password (as a link) |

## Open questions for the owner

- `participant` vs `member` for people with a login. Badges say `Budget Participant`; dialogs say "remove this member".
- Whether `verification code` should replace `OTP` everywhere, or only in body text.
- The single name for the warning setting (`Warning threshold`, `Alert at` and `Warning at` all appear today).
