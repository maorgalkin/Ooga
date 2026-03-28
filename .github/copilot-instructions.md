<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Ooga - Family Finance Tracker

This is a React TypeScript family finance tracking application built with Vite, Tailwind CSS, and Supabase.

## Key Information

- **Framework**: React 19.1.1 with TypeScript 5.8.3
- **Backend**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS 3.4.x (NOT v4)
- **Testing**: Vitest 3.2.4 + React Testing Library
- **Build Tool**: Vite 7.1.2

## Documentation

For complete project information, refer to:
- `/docs/COMPLETE_FEATURE_SUMMARY.md` - All features and capabilities
- `/docs/SUPABASE_BRINGUP.md` - Backend setup guide
- `/docs/TEST_DOCUMENTATION.md` - Testing guide
- `/docs/DEPRECATED_FEATURES.md` - Historical context

## Important Notes

- All data is stored in Supabase (no localStorage)
- User authentication required
- Budget configuration includes family members and active categories in globalSettings
- Row Level Security (RLS) enabled on all database tables

## Development Guidelines

**CRITICAL**: 
1. **Before implementation**: Each proposed implementation change should be explained in the context of each compilation unit to be changed, including effects it will have on the API, UI, app state and testability, and await confirmation of the operator to change files.
2. **After implementation**: Briefly explain what was changed in each affected file/context.

---

## UI Navigation Hierarchy

**IMPORTANT:** When modifying navigation, tabs, or page structure, update this section to keep it current.

```
App
├── Dashboard (/)
│   ├── Tab: Dashboard - Month carousel, budget overview, alerts, recent transactions
│   ├── Tab: Transactions - Full transaction list with filters
│   ├── Tab: Budget → BudgetManagement page
│   │   ├── Sub-tab: Overview - PersonalBudgetDisplay (view budget) or PersonalBudgetEditor (create)
│   │   ├── Sub-tab: Categories - CategoryList (add, edit, rename, delete, merge categories)
│   │   └── Sub-tab: Settings - BudgetSettings (name, currency, notifications, household, budget history)
│   └── Tab: Insights → InsightsPage
│       ├── Date Range Filter
│       ├── Budget vs Actual Chart
│       └── Category Accuracy Chart
│
└── Auth Pages
    ├── /login
    └── /signup
```

**Key Components:**
- `PersonalBudgetDisplay` - Read-only view of active budget (shown in Overview when budget exists)
- `PersonalBudgetEditor` - Create new budget (shown in Overview when no budget exists)
- `CategoryList` - Full category management with inline actions
- `BudgetSettings` - Currency, notifications, household, budget name, and **budget history**
- `BudgetHistory` - View all budget versions, set active, delete old versions

---

## Frontend Styling Guidelines

### Tailwind CSS Configuration

This project uses **Tailwind CSS v3.4.x** with a standard setup:

- **Config file**: `tailwind.config.js` - JavaScript-based configuration
- **PostCSS**: `postcss.config.mjs` - Standard Tailwind + Autoprefixer
- **CSS entry**: `src/index.css` - Uses `@tailwind base/components/utilities`

**DO NOT upgrade to Tailwind v4** - it uses a completely different CSS-first configuration system that is incompatible with our JS-based config.

### Theme Colors

The app uses a consistent theme color system. When adding UI that needs dynamic theming:

1. **Primary theme colors**: `purple`, `blue`, `green`, `indigo`
2. **Use safelist patterns** in `tailwind.config.js` for dynamically-generated classes
3. **Dark mode**: Uses `media` strategy (OS preference)

Example safelist pattern:
```javascript
{ pattern: /bg-(purple|blue|green|indigo)-(500|600)/, variants: ['hover', 'dark'] }
```

### CSS Best Practices

1. **Prefer Tailwind utility classes** over custom CSS
2. **Use `@layer components`** in `index.css` for reusable component styles
3. **Avoid inline styles** - use Tailwind classes instead
4. **Test both dev and build** - run `npm run build && npm run preview` to ensure consistency

### Dev vs Production Parity

To ensure dev and prod render identically:

1. Always test with `npm run build && npm run preview` before pushing
2. If a class works in dev but not prod, add it to `safelist` in `tailwind.config.js`
3. Dynamic classes (string interpolation) MUST be safelisted

### Reusable Component Patterns

When creating UI components intended for reuse:

1. Accept theme/color props as full class names, not color names
2. Use Tailwind's design tokens (spacing, colors) consistently
3. Support dark mode with `dark:` variants
4. Keep components in `/src/components/` with clear naming

### Modal Design Guidelines

1. **No scrollbars in modals** - Design content to fit without scrolling
2. Use flex layout (`flex flex-col`) instead of fixed heights
3. Keep modals compact - reduce spacing (`space-y-3` vs `space-y-4`)
4. Use native browser controls where possible (e.g., `<input type="color">`)
5. Consistent footer pattern: delete/secondary action left, primary action right

