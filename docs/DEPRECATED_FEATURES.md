# Deprecated Features

This document catalogs features that have been retired from the application. These descriptions are AI-readable and provide enough context for potential re-implementation if needed.

---

## Budget Settings Modal (Deprecated: November 2025)

### Summary
A comprehensive settings modal that allowed users to manage budget configuration through both visual and JSON editing modes.

### Core Functionality

**Visual Editor Mode:**
- **Category Management**: Add, edit, delete budget categories
  - Set monthly spending limits per category
  - Configure warning thresholds (percentage-based)
  - Toggle category active/inactive status
  - Assign colors for visualization
  - Add descriptions
- **Global Settings**: 
  - Currency selection (USD, ILS, EUR, GBP)
  - Warning notifications toggle
  - Email alerts toggle
- **Family Members**: Quick navigation to family members management
- **Real-time validation**: Ensure category names are unique

**JSON Editor Mode:**
- Direct JSON editing of budget configuration
- Syntax validation with error reporting
- Live preview of changes
- Import/Export functionality

### Technical Implementation

**Component**: `src/components/BudgetSettings.tsx`

**Key Features:**
- Dual-mode interface (Visual/JSON tabs)
- Modal-based UI with backdrop
- Local state management for unsaved changes
- Integration with `BudgetConfigService`
- Color picker integration using `getNextAvailableColor` utility
- Category edit modal for detailed configuration
- Real-time JSON synchronization between visual and JSON modes

**Data Structure:**
```typescript
interface BudgetConfiguration {
  version: string;
  lastModified: string;
  categories: {
    [name: string]: {
      monthlyLimit: number;
      warningThreshold: number;
      isActive: boolean;
      color: string;
      description: string;
    }
  };
  globalSettings: {
    currency: string;
    warningNotifications: boolean;
    emailAlerts: boolean;
  };
}
```

**Props Interface:**
```typescript
interface BudgetSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: BudgetConfiguration) => void;
  onOpenFamilyMembers?: () => void;
  familyMembersCount?: number;
}
```

### UI Components Used
- Modal overlay with backdrop blur
- Tabbed navigation (Visual/JSON)
- Form inputs with validation
- Color picker buttons
- Icon buttons (Settings, Save, Download, Upload, Code, Plus, Edit)
- Category list with inline edit/delete actions
- JSON text area with monospace font

### State Management
- Category editing state
- JSON text synchronization
- Validation error states
- New category tracking for unsaved changes
- Global settings editing state

### Reasons for Deprecation
1. **Replaced by Personal Budget System**: All budget configuration moved to database-driven personal budget management in Budget Management tab
2. **Better UX**: New system provides more intuitive category and budget management
3. **Database-First**: Configuration now stored in Supabase instead of localStorage
4. **Reduced Complexity**: Eliminated dual Visual/JSON editing modes
5. **Integrated Workflow**: Budget configuration now part of main dashboard flow

### Migration Path
- Old `BudgetConfigService.loadConfig()` → `useActiveBudget()` hook
- Old localStorage-based categories → Supabase `personal_budgets` table
- Old JSON export/import → Native database backup/restore
- Old modal-based editing → Inline editing in Budget Management tab

### Related Components (Still Active)
- `CategoryEditModal.tsx` - Still used for editing category details
- `PersonalBudgetEditor.tsx` - New primary interface for budget management
- `BudgetManagement.tsx` - Contains category and budget configuration

### Files to Remove
- `src/components/BudgetSettings.tsx`
- Settings button in `src/App.tsx`
- Import statements referencing BudgetSettings

### Potential Re-implementation Use Cases
- **Advanced JSON Import/Export**: Could be useful for bulk data operations
- **Migration Tools**: JSON editing could help users migrate from other budget apps
- **Power User Features**: Some users might prefer direct JSON editing
- **Backup/Restore**: JSON export could be reimplemented as a backup feature
- **Multi-configuration Management**: If users want to maintain multiple budget templates

### Code Patterns Worth Preserving
1. **Dual-mode editing** (Visual + JSON) - useful pattern for configuration UIs
2. **Real-time validation** - immediate feedback on configuration errors
3. **Category color management** - `getNextAvailableColor` utility function
4. **Modal state management** - pattern for complex form modals
5. **JSON synchronization** - keeping visual and text representations in sync

---

---

## Separate Older Transactions Page (Deprecated: November 2025)

### Summary
A standalone page (`/older-transactions`) that provided access to transactions older than the 4 most recent months shown in the Dashboard carousel.

### Core Functionality

**Features:**
- **Month Carousel**: Visual navigation through 4 recent historical months
- **"Earlier (2 Years)" Mode**: Deep search interface for transactions up to 24 months old
  - Month selector dropdown
  - Transaction type filter (all/income/expense)
  - Search by description, category, or family member
- **Transaction Display**: List view with edit capabilities
- **Back to Dashboard Button**: Navigation to return to main Dashboard

### Technical Implementation

**Component**: `src/pages/OlderTransactions.tsx`

**Key Features:**
- Framer Motion carousel animations
- Month navigation with directional transitions
- Advanced search and filtering for historical data
- Edit transaction modal integration

**State Management:**
- Active tab for month carousel (0-3)
- "Show Earlier" mode toggle
- Selected month filter
- Search term and type filters
- Direction tracking for animations
- Edit transaction modal state

**Data Flow:**
```typescript
// Recent months (last 4)
const recentMonths = [0, 1, 2, 3].map(offset => {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return { label, monthName, year, start, end };
});

// All months for deep search (24 months)
const allMonths = Array.from({ length: 24 }, (_, index) => {
  const d = new Date(now.getFullYear(), now.getMonth() - index, 1);
  return { label, start, end, value };
});
```

### Reasons for Deprecation
1. **UX Fragmentation**: Separate page created cognitive overhead (where are my transactions?)
2. **Navigation Complexity**: Required "Back to Dashboard" button and route management
3. **Duplicate Code**: Similar carousel and filtering logic as main Transactions tab
4. **Better Integration**: Users expect all transaction history in one unified view
5. **Simplified Mental Model**: Single Transactions tab with extended history is more intuitive

### Migration Path
- Extend Dashboard Transactions tab carousel to show more months (up to 24)
- Remove "Older" button that navigated to separate page
- Remove `/older-transactions` route from router
- Retire "Back to Dashboard" navigation button
- Consolidate all transaction viewing in single tabbed interface

### Related Components (Still Active)
- `Dashboard.tsx` Transactions tab - Extended to include all history
- `useDashboardData.ts` - Can be extended to support more months
- `dateHelpers.ts` - `getLastNMonths()` function for generating month arrays

### Files to Remove
- `src/pages/OlderTransactions.tsx`
- Route definition in `src/App.tsx`
- Navigation to `/older-transactions` in Dashboard

### Potential Re-implementation Use Cases
- **Standalone Transaction Manager**: Could be repurposed as dedicated transaction management view
- **Advanced Search Page**: Might be useful for power users who need complex filtering
- **Export/Report View**: Could become basis for generating transaction reports
- **Archive View**: If implementing transaction archiving, this UI could be adapted

### Code Patterns Worth Preserving
1. **Month Carousel Animation**: Smooth directional transitions with Framer Motion
2. **Advanced Filtering**: Multi-criteria transaction search (month + type + text search)
3. **Toggle Modes**: Switching between recent view and deep history search
4. **Edit Integration**: Inline edit button with modal for transaction updates

---

## Future Deprecations

_Document additional deprecated features here as they are retired._

---

## Vercel Serverless API + Server-Side Bank Credential Storage (Deprecated: May 2026)

### Summary
The app previously used a Vercel serverless function (`/api/connections`) to manage bank connection credentials. This function encrypted credentials server-side using AES-256-GCM before writing them to Supabase, requiring both an `ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` on the server. As part of the migration to Cloudflare Pages hosting and client-side Cal import, this server layer was eliminated entirely.

### Core Functionality That Was Retired

**`/api/connections` (Vercel serverless function):**
- `GET /api/connections` — list active connections for the authenticated user (using service role)
- `POST /api/connections` — encrypt credentials with AES-256-GCM and store in `credentials_encrypted`
- `DELETE /api/connections?id=X` — delete a connection row
- JWT authentication via Supabase `auth.uid()` verified server-side

**`api-src/connections.ts`** — TypeScript source for the above handler

**`api-src/health.ts`** + `/api/health` — simple health-check endpoint returning Node version

**`build-api.mjs`** — esbuild bundler that compiled `api-src/*.ts` → `api/*.js` for Vercel

**`vercel.json`** — SPA rewrite rules + build config for Vercel deployment

### Why It Was Removed

1. **Server eliminated**: With client-side Cal import (`calDirectService.ts`), the app never needs server-side code to import transactions. No server → no API route needed.
2. **Encryption was vestigial**: The `credentials_encrypted` field was only useful when the server needed to re-authenticate to the bank on behalf of the user (old relay model). The new client-side flow uses OTP → browser holds the session token temporarily; nothing sensitive is stored.
3. **metadata replaces credentials**: Bank connection metadata (`national ID`, `last4Digits`) is stored in `bank_connections.metadata` (jsonb), protected by Supabase RLS. Only the owning user can read it via their JWT; only the project admin can access it via the Supabase dashboard.
4. **Cost**: Cloudflare Pages is free. Vercel free tier had limitations; this simplifies the deployment stack.

### Migration Path
- **`/api/connections` fetch calls** → direct `supabase.from('bank_connections')` queries in `bankImportService.ts`
- **`credentials` parameter** in `addConnection()` → `metadata` parameter (the same key-value data, just stored differently)
- **RLS policies** added via migration 032 to allow client INSERT/UPDATE on `bank_connections`
- **`credentials_encrypted`** column made nullable (migration 032); existing rows retain their values but new rows set it to null
- **`ENCRYPTION_KEY`** env var removed — no longer needed
- **`SUPABASE_SERVICE_ROLE_KEY`** env var removed from server — still usable by developer via Supabase dashboard but not deployed anywhere
- **SPA routing** (`vercel.json` rewrites) → `public/_redirects` (`/* /index.html 200`) for Cloudflare Pages

### Security Trade-offs Documented
- **Old**: national ID AES-256-GCM encrypted in DB; decryption key on Vercel (accessible to Vercel + developer)
- **New**: national ID plaintext in Supabase `metadata` jsonb; protected by RLS (accessible to user + developer via Supabase dashboard); disk encrypted by Supabase infrastructure (AES-256)
- Net difference is minimal for a personal/family app where the developer is the sole DB admin

### Files Removed
- `api/` (compiled Vercel handlers)
- `api-src/` (TypeScript sources)
- `build-api.mjs`
- `vercel.json`

### Environment Variables Removed
- `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- `ENCRYPTION_KEY` (AES key for credential encryption)
- `VITE_SCRAPER_SERVICE_URL` (relay URL — relay removed in an earlier deprecation)
- `VITE_SCRAPER_API_KEY` (relay API key)

### Related Active Code
- `src/services/bankImportService.ts` — now uses `supabase.from('bank_connections')` directly
- `src/services/calDirectService.ts` — client-side Cal import (no server needed)
- `src/components/AddBankAccountModal.tsx` — stores collected fields as `metadata`
- `supabase/migrations/032_bank_connections_client_rls.sql` — INSERT/UPDATE RLS policies

---

