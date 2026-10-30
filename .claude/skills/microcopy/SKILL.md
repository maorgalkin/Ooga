---
name: microcopy
description: Ooga's rules for on-screen text — voice, sentence case, ellipses, button/error/empty-state/confirmation patterns, Hebrew bank terms, accessible names — plus the product glossary (household, participant, family member, connected account, budget terms). Use whenever you write or review user-facing strings in src/ (JSX text, labels, placeholders, titles, aria-labels, alert/confirm/error messages).
paths:
  - "src/**/*.tsx"
  - "src/services/**/*.ts"
---

# Ooga microcopy

Ooga helps a family see where their money goes. The person reading is usually busy, often on a phone, sometimes worried about money. Text should make the next step obvious and never make them feel blamed or confused.

The newest screens (import review, "Paid with", the duplicates bubble) already follow these rules; older screens don't yet. When you touch an older screen, bring the strings you change up to these rules — don't rewrite the whole file unasked.

Terms and their meanings: [glossary.md](glossary.md). Use the glossary term every time; inconsistency reads as a different feature.

## Voice

- **Plain and specific.** Name the thing: "Couldn't save the budget" beats "An error occurred". Say what happens next: "The next import will match the bank's charge to it."
- **Calm.** No exclamation marks except a real celebration (first budget created), at most one per screen. "Saved", not "Saved!".
- **Warm, not cute.** Light humour is fine in an empty state, never in an error, a warning about money, or anything destructive.
- **No internals.** Never show stack traces, "check the console", service names ("scraper service"), table names, or raw `error.message` from Supabase. Log details with `console.error`; show the person a human sentence.
- **You/your** for the reader; "we" sparingly for Ooga itself.

## Mechanics

| Rule | Do | Don't |
|---|---|---|
| Sentence case everywhere: headings, buttons, tabs, labels, badges | `Add transaction`, `Connected accounts`, `Budget history` | `Add Transaction`, `Connected Accounts` |
| Proper nouns keep their capitals | `Visa Cal`, `Discount Bank`, `Isracard`, `Max`, `Ooga` | `visa cal` |
| Ellipsis is one character, `…` (U+2026) | `Saving…`, `Loading budget…` | `Saving...` |
| Optional fields say so in lowercase | `Notes (optional)` | `Notes (Optional)`, a `*` on required fields |
| Prefer a period or colon to a dash inside UI sentences | `Over budget. Time to review.` | `Over budget - time to review!` |
| No emoji in text; use a lucide icon next to it if it needs one | `<Lightbulb/> Getting started` | `💡 Getting Started:` |
| Numbers as digits, amounts through the formatter | `{formatCurrencyFromSettings(x, settings)}` | `$` or `₪` typed into a label |
| Handle singular and plural | `1 duplicate skipped`, `2 duplicates skipped` | `1 duplicates skipped` |
| Dates through `getUserLocale()` | `toLocaleDateString(getUserLocale(), …)` | a hard-coded `'en-US'` |

## Patterns

**Buttons and links.** Verb + object, 1–3 words: `Add transaction`, `Save changes`, `Remove connection`, `Import transactions`. The primary button repeats the dialog's action (`Delete category`), never `Yes`, `OK` or `Submit`. Keep `Cancel` and `Close` as they are.

**Labels and placeholders.** The label carries the meaning; a placeholder is only an example (`e.g., Groceries`), because it disappears when typing starts. Helper text is one short sentence under the field.

**In-progress states.** Present participle + `…`, naming the object when it helps: `Importing transactions…`, `Testing connection…`. Disable the button while it runs.

**Success.** Short, past tense, no "successfully": `Budget saved`, `3 transactions imported`. Prefer showing the result over announcing it.

**Errors.** What happened, then what to do. Pattern: `Couldn't <verb> <object>.` + one recovery step.
- `Couldn't save the budget. Check your connection and try again.`
- `Couldn't remove the connection. Try again in a minute.`
- Field validation sits next to the field and says how to fix it: `Enter an amount of 0 or more.`
- Show errors inline next to the action. Don't add new `alert()` calls; when you touch an existing one, flag it for the implementer rather than rewriting the component.

**Empty states.** What's empty, why it matters, the next action as a button. `No transactions this month` · `Add one, or import from a connected account.` · `[Add transaction]`.

**Confirmations (destructive).** Title asks about the specific object; body states the consequence and whether it can be undone; the confirm button names the action.
- Title: `Delete "Groceries"?`
- Body: `Its 12 transactions move to Uncategorized. You can't undo this.`
- Buttons: `Delete category` · `Cancel`

**Numbers in sentences.** Put the number first when it's the news: `12 transactions imported, 3 duplicates skipped.`

## Hebrew and bank text

- The UI is English; a Hebrew translation is in progress behind a flag (`docs/I18N.md` has the rules for writing it, including the neutral form of address every Hebrew string needs). Text that comes from banks (descriptions, merchant names) is usually Hebrew: render it untouched with `dir="auto"`, and never translate or reformat it.
- Bank login fields use the English label plus the exact term the bank's own site shows, in parentheses: `National ID (ת.ז.)`, `Access code (קוד גישה)`. Check the Hebrew against the bank's site before changing it.
- Bank and card names follow their own branding: `Visa Cal`, `Max`, `Isracard`, `Amex Israel`, `Discount Bank`, `Bank Hapoalim`, `Bank Leumi`.

## Accessible names

- Icon-only buttons get an `aria-label` with the same verb + object a visible button would use: `aria-label="Delete transaction"`.
- `title` is a tooltip, not a label; anything important in a tooltip also needs a visible or `aria-` equivalent.
- Don't rely on colour words ("the red ones"); say "over-budget categories".
- Counts in accessible names match the visible count: `2 duplicates skipped`.

## Changing existing copy

1. Find every place the string appears, including tests: `grep -rn "Old text" src tests`. Tests query by visible text and accessible name, so they change with the copy.
2. Change the string and its tests together; keep test assertions exact (no loosening to a regex).
3. Run the affected tests (`npx vitest run <file>`) and `npm run typecheck`.
4. If you settled a terminology question, record it in `glossary.md` in the same change.

Never change while editing copy: DB enum values (`'participant'`, `'owner'`, `'expense'`), keys and IDs, query keys, CSS classes, Hebrew data from banks, or anything users can't see.
