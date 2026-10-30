# Ooga in Hebrew

The English rules in `SKILL.md` still apply (plain, specific, calm, no internals). This file adds what's different in Hebrew. How the text is stored and shown: `docs/I18N.md`.

The owner reviewed these rules and terms on 2026-10-30. If a term changes, update this file and the strings together.

## Addressing the reader

Hebrew verbs and adjectives change with the reader's gender. Every key has a **neutral** version; people who choose a form of address may get a gendered variant (`key_female`, `key_male`) where it reads better.

| Situation | Neutral (always written) | Don't |
|---|---|---|
| Buttons, tabs, headings, menu items | Verbal noun: `שמירה`, `ביטול`, `הוספת תנועה`, `ייבוא תנועות` | Imperative: `שמור`, `הוסיפי` |
| Instructions and hints | Impersonal: `אפשר לייבא…`, `כדאי לבדוק…`, `צריך להזין סכום` | `את/ה יכול/ה`, `הזן/י` |
| Questions to the reader | Infinitive: `למחוק את "מכולת"?`, `לצאת ממשק הבית?` | `האם את/ה בטוח/ה?` |
| Things the reader did | 2nd-person past, written the same for both: `שכחת`, `הוספת`, `בחרת` | |
| Our side of an error | `לא הצלחנו לשמור את התקציב.` | Passive blame: `השמירה נכשלה` |

Add `_female`/`_male` variants only when the neutral wording is noticeably stiff, mostly longer encouraging sentences (empty states, onboarding). Never on buttons.

Other people (participants, family members) have unknown gender too: prefer plural or the role (`המשתתפים`, `בני המשפחה`). When one person must be named by role, write the slash form: `משתתף/ת`.

## Mechanics

| Rule | Do | Don't |
|---|---|---|
| Prefix before Latin letters or digits takes a maqaf (U+05BE) | `ב־Ooga`, `ל־2026`, `מ־Visa Cal` | `בOoga`, `ב-Ooga` |
| Ellipsis is one character | `שומרים…` | `...` |
| Amounts and dates go through the formatters; never type `₪` | `{formatCurrencyFromSettings(x, settings)}` | `₪500` in a string |
| Plurals through i18next (`_one`, `_two`, `_other`) | `3 כפילויות דולגו` / `כפילות אחת דולגה` | `1 כפילויות` |
| Plain double quotes around a quoted name | `למחוק את "מכולת"?` | gershayim (״) as quotes |
| No English words in Hebrew text, except names below | `תמונת מצב` | `דשבורד` |

Text from banks stays as the bank wrote it, with `dir="auto"`.

## Patterns

- **Errors:** `לא הצלחנו ל<פועל> <מושא>.` + one step: `לא הצלחנו לשמור את התקציב. כדאי לבדוק את החיבור ולנסות שוב.`
- **In progress:** present plural, which reads as "we": `שומרים…`, `מייבאים תנועות…`.
- **Success:** short, past tense, the object first: `התקציב נשמר`, `3 תנועות יובאו`.
- **Empty states:** `אין תנועות בחודש הזה` · `אפשר להוסיף תנועה או לייבא מחשבון מקושר.` · `[הוספת תנועה]`
- **Destructive confirmations:** title `למחוק את "מכולת"?`; body states the consequence (`12 התנועות שלה יעברו ל"ללא קטגוריה". אי אפשר לבטל את זה.`); button `מחיקת קטגוריה` · `ביטול`.

## Glossary

| English | Hebrew | Notes |
|---|---|---|
| Ooga | Ooga | Stays Latin; with a prefix: `ב־Ooga` |
| Take the Cake (logo tagline) | איפה העוגה? | A line of its own, not a translation of the pun |
| household | משק בית | `הגדרות משק הבית`, `יציאה ממשק הבית` |
| owner | בעלים | Same for any gender |
| participant | משתתף/ת; plural משתתפים | Prefer the plural |
| family member | בן/בת משפחה; plural בני משפחה | Field: `בן/בת משפחה (לא חובה)` |
| invitation code | קוד הזמנה | |
| transaction | תנועה; plural תנועות | As in banking apps; covers income and expenses. Not `עסקה`, which reads as a card purchase |
| expense / income | הוצאה / הכנסה | Filters: `הוצאות`, `הכנסות` |
| category / Uncategorized | קטגוריה / ללא קטגוריה | |
| installments | תשלומים | `תשלום 3 מתוך 12` |
| Paid with / Received in | שולם באמצעות / התקבל ב־ | |
| budget | תקציב | |
| monthly limit | תקרה חודשית | |
| warning threshold | סף התראה | `התראה ב־80%` |
| over budget | חריגה מהתקציב | Badge: `חריגה` |
| adjustment | התאמה | `תזמון לחודש הבא` |
| budget history / version | היסטוריית התקציב / גרסה | |
| exact amounts | סכומים מדויקים | |
| connected account | חשבון מקושר | Section: `חשבונות מקושרים` |
| import | ייבוא | `ייבוא תנועות` |
| duplicate | כפילות | |
| merge | מיזוג | |
| verification code | קוד אימות | `שליחת קוד` |
| Dashboard / Transactions / Budget / Insights | תמונת מצב / תנועות / תקציב / תובנות | The four tabs |
| Settings / Categories / Overview | הגדרות / קטגוריות / סקירה | Budget sub-tabs |
| Sign in / Sign out | התחברות / התנתקות | |
| Create account | יצירת חשבון | |
| Forgot your password? | שכחת את הסיסמה? | |
| (optional) | (לא חובה) | |
| Cancel / Close / Save | ביטול / סגירה / שמירה | |

Banks and cards by their Hebrew names: ויזה כאל, מקס, ישראכרט, אמריקן אקספרס, בנק דיסקונט, בנק הפועלים, בנק לאומי.
