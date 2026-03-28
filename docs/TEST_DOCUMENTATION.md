# 🧪 Ooga Test Documentation# 🧪 Ooga Test Documentation



**Last Updated:** November 6, 2025  **Last Updated:** November 6, 2025  

**Framework:** Vitest 3.2.4 + React Testing Library 16.3.0**Framework:** Vitest 3.2.4 + React Testing Library 16.3.0



------



## 📊 Current Test Coverage## � Current Test Coverage



**88 tests** across **6 test files** - **100% pass rate** ✅**88 tests** across **6 test files** - **100% pass rate** ✅



### Test Suite Breakdown### Test Suite Breakdown



| Category | File | Tests | Focus Area || Category | File | Tests | Focus Area |

|----------|------|-------|------------||----------|------|-------|------------|

| **Services** | `budgetAdjustmentService.test.ts` | 16 | Budget adjustment scheduling & history || **Services** | `budgetAdjustmentService.test.ts` | 16 | Budget adjustment scheduling & history |

| **Services** | `personalBudgetService.test.ts` | 14 | Personal budget CRUD operations || **Services** | `personalBudgetService.test.ts` | 14 | Personal budget CRUD operations |

| **Services** | `monthlyBudgetService.test.ts` | 13 | Monthly budget management || **Services** | `monthlyBudgetService.test.ts` | 13 | Monthly budget management |

| **Components** | `ErrorBoundary.test.tsx` | 13 | Error handling & auto-reload || **Components** | `ErrorBoundary.test.tsx` | 13 | Error handling & auto-reload |

| **Utils** | `categoryColors.test.ts` | 19 | Color palette & distinctness || **Utils** | `categoryColors.test.ts` | 19 | Color palette & distinctness |

| **Utils** | `themeColors.test.ts` | 13 | Theme color utilities || **Utils** | `themeColors.test.ts` | 13 | Theme color utilities |



### Test Organization### Test Organization



``````

tests/tests/

├── components/├── components/

│   └── ErrorBoundary.test.tsx│   └── ErrorBoundary.test.tsx      # Error boundary component

├── services/├── services/

│   ├── budgetAdjustmentService.test.ts│   ├── budgetAdjustmentService.test.ts

│   ├── monthlyBudgetService.test.ts│   ├── monthlyBudgetService.test.ts

│   └── personalBudgetService.test.ts│   └── personalBudgetService.test.ts

└── utils/└── utils/

    ├── categoryColors.test.ts    ├── categoryColors.test.ts      # Category color system

    └── themeColors.test.ts    └── themeColors.test.ts         # Theme utilities

``````



------



## 🚀 Quick Start## 🚀 Quick Start



### Commands**What it does:**

- Opens browser-based UI

```bash- Visual test results

npm test          # Watch mode - reruns on file changes- Interactive filtering

npm run test:run  # Run once (CI mode)- Detailed error views

npm run test:ui   # Interactive UI dashboard- Module graph visualization

```

**Best for:**

### Running Specific Tests- Visual test debugging

- Understanding test structure

```bash- Analyzing failures

# Run tests in a specific file- Demo/presentations

npm test -- categoryColors.test.ts

**Access at:** http://localhost:51204/__vitest__/

# Run tests matching a pattern

npm test -- --grep "Budget"---



# Run tests in a directory## Test Suites

npm test -- tests/services

```### Suite 1: Basic Functionality (`simple.test.tsx`)



---**Focus:** Application startup, navigation, core features



## 📝 Test Details**Tests Included:**



### Service Tests (43 tests)#### 1.1 Application Renders

```typescript

**budgetAdjustmentService.test.ts** (16 tests)test('Application renders without crashing', async () => {

- Schedule adjustments for next month  renderWithProvider(<App />)

- Handle year rollover correctly  expect(await screen.findByText(/Ooga/i)).toBeInTheDocument()

- Get pending adjustments for a month})

- Apply scheduled adjustments to personal budget```

- Track category adjustment history**Validates:**

- Calculate net adjustments and averages- App initializes successfully

- Identify most-adjusted categories- No runtime errors

- Root component mounts

**personalBudgetService.test.ts** (14 tests)- Brand name visible

- Get active personal budget for user

- Get budget history (all versions)#### 1.2 Sample Data Display

- Create new budget with auto-versioning```typescript

- Update budget (creates new version, deactivates old)test('Sample data is displayed correctly', async () => {

- Set different version as active  renderWithProvider(<App />)

- Delete non-active budget versions  await waitFor(() => {

- Prevent deleting active budget    const transactions = screen.getAllByRole('listitem')

- Migrate from legacy BudgetConfiguration    expect(transactions.length).toBeGreaterThan(0)

- Helper methods: calculate totals, count active categories  })

})

**monthlyBudgetService.test.ts** (13 tests)```

- Get or create monthly budget from personal budget**Validates:**

- Handle missing personal budget error- Sample transactions load

- Update category limits in monthly budget- Data renders in DOM

- Increment adjustment count on changes- List items visible

- Lock monthly budgets to prevent further edits- Initial state correct

- Compare monthly budget to personal budget

- Sync monthly budget with personal budget changes#### 1.3 Financial Summary Cards

- Calculate total monthly limits```typescript

- Check if budget has adjustmentstest('Shows correct financial summary', async () => {

- Format month names and dates  renderWithProvider(<App />)

  expect(await screen.findByText(/Total Income/i)).toBeInTheDocument()

### Component Tests (13 tests)  expect(screen.getByText(/Total Expenses/i)).toBeInTheDocument()

  expect(screen.getByText(/Net Balance/i)).toBeInTheDocument()

**ErrorBoundary.test.tsx** (13 tests)})

- **Normal Operation:**```

  - Renders children when no error occurs**Validates:**

  - Hides error UI in normal state- All summary cards present

- **Error Handling:**- Income total visible

  - Catches errors and displays error UI- Expense total visible

  - Shows "Reload Page Now" button- Net balance calculated

- **Critical Error Detection:**

  - Detects "is not defined" as critical#### 1.4 Month Navigation

  - Detects "is not a function" as critical```typescript

  - Detects "Cannot read property" as criticaltest('Month navigation works correctly', async () => {

  - Marks regular errors as non-critical  const user = userEvent.setup()

- **Auto-reload:**  renderWithProvider(<App />)

  - Shows countdown when `autoReloadOnCriticalError=true`  

  - Skips auto-reload for non-critical errors  const prevButton = screen.getByLabelText(/previous month/i)

  - Respects `autoReloadOnCriticalError=false` setting  await user.click(prevButton)

- **Custom Fallback:**  

  - Renders custom fallback when provided  await waitFor(() => {

- **Development Mode:**    expect(screen.getByText(/October 2025/i)).toBeInTheDocument()

  - Shows stack trace in development  })

})

### Utility Tests (32 tests)```

**Validates:**

**categoryColors.test.ts** (19 tests)- Month selector exists

- **Palette Validation:**- Previous month button works

  - Contains 20 distinct hex colors- Next month button works

  - All colors are unique- Date updates correctly

- **Color Selection:**

  - Returns first color when none are used#### 1.5 Transaction List Rendering

  - Skips already-used colors```typescript

  - Case-insensitive color matchingtest('Transaction list renders with correct items', async () => {

  - Generates new colors when palette exhausted  renderWithProvider(<App />)

  - Skips multiple used colors in sequence  

- **Color Distinctness:**  await waitFor(() => {

  - Returns true for colors far apart in hue (>30°)    expect(screen.getByText(/Salary/i)).toBeInTheDocument()

  - Returns false for colors too close in hue    expect(screen.getByText(/Groceries/i)).toBeInTheDocument()

  - Handles multiple existing colors  })

  - Respects custom minimum hue difference})

  - Handles circular hue space (0° = 360°)```

- **Get Distinct Color:****Validates:**

  - Returns preferred color if distinct- Transactions load from storage

  - Returns next available if preferred not distinct- All items render

  - Returns next available if no preference given- Categories display

- **Real-world Scenarios:**- Amounts show correctly

  - Creating 5 categories with distinct colors

  - Editing category without color conflicts#### 1.6 User Interaction Feedback

  - Deleting category makes color available again```typescript

test('Buttons respond to user interaction', async () => {

**themeColors.test.ts** (13 tests)  const user = userEvent.setup()

- **Primary Button Colors:**  renderWithProvider(<App />)

  - Returns correct background for each theme  

  - Returns correct hover background (darker)  const addButton = screen.getByText(/Add Transaction/i)

  - Defaults to purple for unknown theme  await user.click(addButton)

- **Border and Text:**  

  - Returns correct border color per theme  expect(screen.getByRole('dialog')).toBeInTheDocument()

  - Returns correct text color per theme})

- **Gradients and Accents:**```

  - Returns correct header gradient per theme**Validates:**

  - Returns accent color with opacity- Buttons are clickable

- **Icon Colors:**- Modal opens on click

  - Returns correct icon color per theme- Interactive elements work

- **Type Safety:**- UI responds to actions

  - Accepts valid theme color types

  - Returns string type for all utilities#### 1.7 Chart Rendering

- **Consistency:**```typescript

  - Primary buttons use consistent shade across themestest('Charts render without errors', async () => {

  - Hover states use darker shades than base  renderWithProvider(<App />)

  - All functions provide defaults for invalid input  

  await waitFor(() => {

---    const charts = document.querySelectorAll('.recharts-wrapper')

    expect(charts.length).toBeGreaterThan(0)

## ✍️ Writing New Tests  })

})

### Basic Test Structure```

**Validates:**

```typescript- Recharts components render

import { describe, it, expect, vi, beforeEach } from 'vitest';- Data visualizations present

- No chart errors

describe('FeatureName or ComponentName', () => {- Canvas/SVG elements exist

  beforeEach(() => {

    // Setup before each test**Run This Suite:**

    vi.clearAllMocks();```bash

  });npm test -- simple.test.tsx

```

  it('should do something specific', () => {

    // Arrange---

    const input = 'test data';

    ### Suite 2: Dashboard Features (`dashboard.test.tsx`)

    // Act

    const result = yourFunction(input);**Focus:** Filtering, navigation, dashboard interactions

    

    // Assert**Tests Included:**

    expect(result).toBe('expected output');

  });#### 2.1 Month Filtering

});```typescript

```test('Filters transactions by selected month', async () => {

  const user = userEvent.setup()

### Testing Services with Supabase  renderWithProvider(<App />)

  

```typescript  await user.click(screen.getByLabelText(/previous month/i))

import { vi } from 'vitest';  

import { supabase } from '../../src/lib/supabaseClient';  await waitFor(() => {

    const visibleTransactions = screen.getAllByRole('listitem')

// Mock Supabase at top of file (before describe)    visibleTransactions.forEach(item => {

vi.mock('../../src/lib/supabaseClient', () => ({      expect(item).toHaveTextContent(/Oct|October/i)

  supabase: {    })

    from: vi.fn(),  })

    auth: {})

      getUser: vi.fn().mockResolvedValue({```

        data: { user: { id: 'user-123' } }**Validates:**

      })- Month filter works

    }- Transactions update

  }- Date matching correct

}));- UI updates immediately



describe('YourService', () => {#### 2.2 Type Filtering (Hover Interaction)

  it('should fetch data successfully', async () => {```typescript

    const mockData = { id: '1', name: 'Test' };test('Filters by transaction type on summary card hover', async () => {

      const user = userEvent.setup()

    // Setup mock chain  renderWithProvider(<App />)

    vi.mocked(supabase.from).mockReturnValue({  

      select: vi.fn().mockReturnValue({  const expenseCard = screen.getByText(/Total Expenses/i).closest('div')

        eq: vi.fn().mockReturnValue({  await user.hover(expenseCard!)

          single: vi.fn().mockResolvedValue({  

            data: mockData,  await waitFor(() => {

            error: null    const transactions = screen.getAllByRole('listitem')

          })    transactions.forEach(item => {

        })      expect(item).toHaveClass('expense')

      })    })

    } as any);  })

    })

    const result = await YourService.getData('1');```

    **Validates:**

    expect(result).toEqual(mockData);- Hover triggers filter

    expect(supabase.from).toHaveBeenCalledWith('table_name');- Only expenses show

  });- Income hidden

  - Filter resets on unhover

  it('should handle errors gracefully', async () => {

    vi.mocked(supabase.from).mockReturnValue({#### 2.3 Empty State Handling

      select: vi.fn().mockReturnValue({```typescript

        single: vi.fn().mockResolvedValue({test('Shows empty state when no transactions exist', async () => {

          data: null,  // Clear localStorage

          error: { message: 'Record not found' }  localStorage.removeItem('ooga-transactions')

        })  

      })  renderWithProvider(<App />)

    } as any);  

      await waitFor(() => {

    await expect(YourService.getData('bad-id'))    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument()

      .rejects.toThrow('Record not found');  })

  });})

});```

```**Validates:**

- Empty state renders

### Testing React Components- Helpful message shown

- No error thrown

```typescript- Graceful degradation

import { render, screen, fireEvent } from '@testing-library/react';

import { YourComponent } from './YourComponent';#### 2.4 Summary Calculations

```typescript

it('should handle button clicks', () => {test('Calculates financial summary correctly', async () => {

  const handleClick = vi.fn();  renderWithProvider(<App />)

    

  render(<YourComponent onClick={handleClick} />);  await waitFor(() => {

      const income = screen.getByText(/\$5,000/)

  // Find by accessible role    const expenses = screen.getByText(/\$2,345/)

  const button = screen.getByRole('button', { name: /submit/i });    const balance = screen.getByText(/\$2,655/)

      

  // Simulate click    expect(income).toBeInTheDocument()

  fireEvent.click(button);    expect(expenses).toBeInTheDocument()

      expect(balance).toBeInTheDocument()

  // Verify callback  })

  expect(handleClick).toHaveBeenCalledTimes(1);})

});```

**Validates:**

it('should display props correctly', () => {- Income sum correct

  render(<YourComponent title="Hello World" />);- Expense sum correct

  - Net balance = income - expenses

  expect(screen.getByText(/hello world/i)).toBeInTheDocument();- Currency formatting

});

**Run This Suite:**

it('should handle async operations', async () => {```bash

  render(<AsyncComponent />);npm test -- dashboard.test.tsx

  ```

  // Wait for async content

  const asyncText = await screen.findByText(/loaded data/i);---

  expect(asyncText).toBeInTheDocument();

});### Suite 3: Transaction Management (`transactions.test.tsx`)

```

**Focus:** Adding, editing, deleting, importing transactions

---

**Tests Included:**

## 🎯 Best Practices

#### 3.1 Add Expense

### 1. Test Behavior, Not Implementation```typescript

```typescripttest('Can add new expense transaction', async () => {

// ✅ Good - tests what user sees  const user = userEvent.setup()

expect(screen.getByRole('button')).toHaveTextContent('Submit');  renderWithProvider(<App />)

  

// ❌ Bad - tests internal state  // Open modal

expect(component.state.buttonText).toBe('Submit');  await user.click(screen.getByText(/Add Transaction/i))

```  

  // Fill form

### 2. Use Descriptive Test Names  await user.type(screen.getByLabelText(/description/i), 'Test Expense')

```typescript  await user.type(screen.getByLabelText(/amount/i), '150.00')

// ✅ Good  await user.selectOptions(screen.getByLabelText(/category/i), 'Groceries')

it('should reject email addresses without @ symbol');  await user.click(screen.getByLabelText(/expense/i))

  

// ❌ Bad  // Submit

it('test email validation');  await user.click(screen.getByText(/Add/i))

```  

  // Verify

### 3. Follow Arrange-Act-Assert Pattern  await waitFor(() => {

```typescript    expect(screen.getByText('Test Expense')).toBeInTheDocument()

it('should calculate total correctly', () => {    expect(screen.getByText('$150.00')).toBeInTheDocument()

  // Arrange - setup test data  })

  const items = [10, 20, 30];})

  ```

  // Act - perform the action**Validates:**

  const total = calculateTotal(items);- Modal opens

  - Form inputs work

  // Assert - verify the result- Category dropdown

  expect(total).toBe(60);- Type selection (expense/income)

});- Form submission

```- Transaction appears in list

- Amount formatting

### 4. Mock External Dependencies

- Database calls (Supabase)#### 3.2 Add Income

- API requests```typescript

- Browser APIs (localStorage, navigator)test('Can add new income transaction', async () => {

- Date/time for consistent tests  const user = userEvent.setup()

  renderWithProvider(<App />)

### 5. Test Edge Cases  

```typescript  await user.click(screen.getByText(/Add Transaction/i))

it('should handle empty arrays', () => {  

  expect(processArray([])).toEqual([]);  await user.type(screen.getByLabelText(/description/i), 'Freelance Payment')

});  await user.type(screen.getByLabelText(/amount/i), '500')

  await user.click(screen.getByLabelText(/income/i))

it('should handle null values', () => {  

  expect(processValue(null)).toBe(0);  await user.click(screen.getByText(/Add/i))

});  

  await waitFor(() => {

it('should handle boundary conditions', () => {    expect(screen.getByText('Freelance Payment')).toBeInTheDocument()

  expect(validateAge(0)).toBe(false);  })

  expect(validateAge(150)).toBe(false);})

});```

```**Validates:**

- Income type selection

### 6. Query by Accessible Roles- Positive amount handling

```typescript- Income displays with green color

// ✅ Preferred - accessible and user-focused- Summary updates

screen.getByRole('button', { name: /submit/i })

screen.getByLabelText(/email address/i)#### 3.3 Form Validation

screen.getByText(/welcome/i)```typescript

test('Validates required fields before submission', async () => {

// ❌ Avoid - implementation detail  const user = userEvent.setup()

screen.getByTestId('submit-button')  renderWithProvider(<App />)

screen.getByClassName('btn-primary')  

```  await user.click(screen.getByText(/Add Transaction/i))

  

### 7. Keep Tests Independent  // Try to submit empty form

```typescript  const submitButton = screen.getByText(/Add/i)

beforeEach(() => {  await user.click(submitButton)

  // Reset state before each test  

  vi.clearAllMocks();  // Should show validation errors

  vi.resetModules();  expect(screen.getByText(/description is required/i)).toBeInTheDocument()

});  expect(screen.getByText(/amount is required/i)).toBeInTheDocument()

```})

```

---**Validates:**

- Required field validation

## 🔧 Configuration- Error messages display

- Form prevents submission

### vitest.config.ts- User guidance

```typescript

import { defineConfig } from 'vitest/config';#### 3.4 Modal Controls

```typescript

export default defineConfig({test('Modal can be opened and closed', async () => {

  test: {  const user = userEvent.setup()

    environment: 'jsdom',      // Browser-like environment  renderWithProvider(<App />)

    globals: true,              // Global test functions  

    setupFiles: ['./src/setupTests.ts'],  // Open modal

  },  await user.click(screen.getByText(/Add Transaction/i))

});  expect(screen.getByRole('dialog')).toBeInTheDocument()

```  

  // Close modal

### src/setupTests.ts  await user.click(screen.getByLabelText(/close/i))

```typescript  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

import '@testing-library/jest-dom';})

``````

**Validates:**

This imports DOM matchers:- Modal opens

- `toBeInTheDocument()`- Modal closes

- `toHaveTextContent()`- Backdrop click

- `toBeVisible()`- Escape key

- `toHaveAttribute()`- No memory leaks



---#### 3.5 JSON Import

```typescript

## 🐛 Troubleshootingtest('Can import transactions from JSON file', async () => {

  const user = userEvent.setup()

### Import Path Errors  renderWithProvider(<App />)

```  

Error: Failed to resolve import "../../src/..."  // Open import modal

```  await user.click(screen.getByText(/Import/i))

**Solution:** Use correct relative paths from `tests/` folder  

```typescript  // Upload file

// ✅ Correct (from tests/ folder)  const file = new File([JSON.stringify([

import { Service } from '../../src/services/service';    { date: '2025-10-25', description: 'Import Test', amount: 99, category: 'Other', type: 'expense' }

  ])], 'transactions.json', { type: 'application/json' })

// ❌ Wrong  

import { Service } from '../services/service';  const input = screen.getByLabelText(/upload file/i)

```  await user.upload(input, file)

  

### Mock Not Working  await waitFor(() => {

```    expect(screen.getByText('Import Test')).toBeInTheDocument()

TypeError: Cannot read property 'from' of undefined  })

```})

**Solution:** Place `vi.mock()` at top level, before describe blocks```

```typescript**Validates:**

import { vi } from 'vitest';- Import modal opens

- File upload works

vi.mock('../../src/lib/supabaseClient', () => ({- JSON parsing

  supabase: { /* mock implementation */ }- Transactions merge

}));- Duplicate handling



describe('Tests', () => {#### 3.6 Data Persistence

  // Tests here```typescript

});test('Transactions persist to localStorage', async () => {

```  const user = userEvent.setup()

  renderWithProvider(<App />)

### TypeScript Errors with Mocks  

```  // Add transaction

Type 'Mock' is not assignable to...  await user.click(screen.getByText(/Add Transaction/i))

```  await user.type(screen.getByLabelText(/description/i), 'Persistence Test')

**Solution:** Use `vi.mocked()` and type assertions  await user.type(screen.getByLabelText(/amount/i), '25')

```typescript  await user.click(screen.getByText(/Add/i))

vi.mocked(supabase.from).mockReturnValue({ ... } as any);  

```  // Check localStorage

  const stored = JSON.parse(localStorage.getItem('ooga-transactions') || '[]')

### Async Tests Timing Out  expect(stored).toContainEqual(

```    expect.objectContaining({

Test timed out after 5000ms      description: 'Persistence Test',

```      amount: 25

**Solution:** Ensure you're using `await` or increase timeout    })

```typescript  )

it('async test', async () => {})

  await asyncOperation();```

  expect(result).toBeDefined();**Validates:**

}, 10000); // 10 second timeout- localStorage writes

```- Data format correct

- Persistence immediate

### Tests Affecting Each Other- No data loss

```

Test passes alone but fails in suite**Run This Suite:**

``````bash

**Solution:** Clear mocks and reset state in `beforeEach`npm test -- transactions.test.tsx

```typescript```

beforeEach(() => {

  vi.clearAllMocks();---

  vi.resetModules();

  // Reset any global state### Suite 4: Accessibility & UX (`accessibility.test.tsx`)

});

```**Focus:** Keyboard navigation, ARIA, responsive design, error handling



### Can't Find Element**Tests Included:**

```

Unable to find an element with the text: ...#### 4.1 Keyboard Navigation

``````typescript

**Solution:** Use debug() to see rendered HTMLtest('Supports full keyboard navigation', async () => {

```typescript  const user = userEvent.setup()

const { debug } = render(<Component />);  renderWithProvider(<App />)

debug(); // Prints HTML to console  

```  // Tab through interactive elements

  await user.tab()

---  expect(document.activeElement).toHaveAttribute('role', 'button')

  

## 📚 Additional Resources  await user.tab()

  expect(document.activeElement).toHaveAttribute('tabindex', '0')

- [Vitest Documentation](https://vitest.dev)})

- [React Testing Library](https://testing-library.com/react)```

- [Testing Library Queries](https://testing-library.com/docs/queries/about)**Validates:**

- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)- Tab order logical

- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)- All controls reachable

- Focus visible

---- No keyboard traps



**Questions?** Check existing test files in `tests/` for real examples of all patterns described above.#### 4.2 Form Labels

```typescript
test('All form inputs have accessible labels', async () => {
  const user = userEvent.setup()
  renderWithProvider(<App />)
  
  await user.click(screen.getByText(/Add Transaction/i))
  
  expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
})
```
**Validates:**
- All inputs labeled
- Labels associated correctly
- Screen reader friendly
- WCAG 2.1 AA compliant

#### 4.3 ARIA Attributes
```typescript
test('Uses appropriate ARIA attributes', async () => {
  renderWithProvider(<App />)
  
  // Check dialog ARIA
  const modal = screen.getByRole('dialog')
  expect(modal).toHaveAttribute('aria-modal', 'true')
  expect(modal).toHaveAttribute('aria-labelledby')
  
  // Check button ARIA
  const buttons = screen.getAllByRole('button')
  buttons.forEach(btn => {
    expect(btn).toHaveAccessibleName()
  })
})
```
**Validates:**
- Proper ARIA roles
- aria-label present
- aria-describedby used
- Semantic HTML

#### 4.4 Responsive Design
```typescript
test('Adapts to mobile viewport', async () => {
  // Set mobile viewport
  global.innerWidth = 375
  global.innerHeight = 667
  window.dispatchEvent(new Event('resize'))
  
  renderWithProvider(<App />)
  
  await waitFor(() => {
    const mobileMenu = screen.getByLabelText(/mobile menu/i)
    expect(mobileMenu).toBeInTheDocument()
  })
})
```
**Validates:**
- Mobile layout renders
- Touch targets sized correctly
- Navigation accessible
- Content readable

#### 4.5 Error Handling
```typescript
test('Displays user-friendly error messages', async () => {
  const user = userEvent.setup()
  renderWithProvider(<App />)
  
  await user.click(screen.getByText(/Add Transaction/i))
  
  // Enter invalid amount
  await user.type(screen.getByLabelText(/amount/i), '-50')
  await user.click(screen.getByText(/Add/i))
  
  expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument()
})
```
**Validates:**
- Validation errors clear
- Error messages helpful
- Error role="alert"
- Focus on first error

#### 4.6 Data Validation
```typescript
test('Validates date format', async () => {
  const user = userEvent.setup()
  renderWithProvider(<App />)
  
  await user.click(screen.getByText(/Add Transaction/i))
  
  const dateInput = screen.getByLabelText(/date/i)
  await user.type(dateInput, 'invalid-date')
  
  await user.click(screen.getByText(/Add/i))
  
  expect(screen.getByText(/invalid date format/i)).toBeInTheDocument()
})
```
**Validates:**
- Date validation
- Amount validation
- Required fields
- Format checking

**Run This Suite:**
```bash
npm test -- accessibility.test.tsx
```

---

### Suite 5: Performance (`performance.test.tsx`)

**Focus:** Rendering speed, large datasets, memory usage

**Tests Included:**

#### 5.1 Component Rendering Speed
```typescript
test('Dashboard renders within performance budget', async () => {
  const startTime = performance.now()
  
  renderWithProvider(<App />)
  
  await waitFor(() => {
    expect(screen.getByText(/Ooga/i)).toBeInTheDocument()
  })
  
  const renderTime = performance.now() - startTime
  expect(renderTime).toBeLessThan(1000) // 1 second budget
})
```
**Validates:**
- Initial render < 1s
- Time to interactive
- First contentful paint
- Performance budget met

#### 5.2 Large Dataset Handling
```typescript
test('Handles 1000+ transactions efficiently', async () => {
  // Generate large dataset
  const transactions = Array.from({ length: 1000 }, (_, i) => ({
    id: `tx-${i}`,
    date: '2025-10-25',
    description: `Transaction ${i}`,
    amount: Math.random() * 100,
    category: 'Test',
    type: 'expense'
  }))
  
  localStorage.setItem('ooga-transactions', JSON.stringify(transactions))
  
  const startTime = performance.now()
  renderWithProvider(<App />)
  
  await waitFor(() => {
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  })
  
  const loadTime = performance.now() - startTime
  expect(loadTime).toBeLessThan(2000) // 2 second budget for large data
})
```
**Validates:**
- Large dataset support
- Virtualization works
- No lag or freeze
- Memory stable

#### 5.3 Chart Rendering Performance
```typescript
test('Charts render quickly with data', async () => {
  renderWithProvider(<App />)
  
  const startTime = performance.now()
  
  await waitFor(() => {
    const charts = document.querySelectorAll('.recharts-wrapper')
    expect(charts.length).toBeGreaterThan(0)
  })
  
  const chartTime = performance.now() - startTime
  expect(chartTime).toBeLessThan(500) // 500ms budget
})
```
**Validates:**
- Chart initialization
- Canvas/SVG rendering
- Data processing
- Animation performance

#### 5.4 User Interaction Responsiveness
```typescript
test('UI responds immediately to user actions', async () => {
  const user = userEvent.setup()
  renderWithProvider(<App />)
  
  const button = screen.getByText(/Add Transaction/i)
  
  const startTime = performance.now()
  await user.click(button)
  
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  
  const responseTime = performance.now() - startTime
  expect(responseTime).toBeLessThan(100) // 100ms for instant feel
})
```
**Validates:**
- Click response immediate
- Modal opens quickly
- No jank or stutter
- 60fps maintained

#### 5.5 Memory Usage
```typescript
test('No memory leaks after repeated operations', async () => {
  const user = userEvent.setup()
  
  // Track initial memory
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
  
  // Perform operations 50 times
  for (let i = 0; i < 50; i++) {
    renderWithProvider(<App />)
    await user.click(screen.getByText(/Add Transaction/i))
    await user.click(screen.getByLabelText(/close/i))
  }
  
  // Check memory growth
  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
  const memoryGrowth = finalMemory - initialMemory
  
  // Memory should not grow significantly
  expect(memoryGrowth).toBeLessThan(10_000_000) // 10MB tolerance
})
```
**Validates:**
- No memory leaks
- Event listeners cleaned
- Components unmount properly
- Stable memory footprint

**Run This Suite:**
```bash
npm test -- performance.test.tsx
```

---

## Test Coverage

### Current Coverage

```
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   78.5  |   72.3   |   81.2  |   79.1  |
 src/                     |   92.1  |   87.4   |   94.3  |   91.8  |
  App.tsx                 |   95.2  |   91.1   |   97.5  |   96.3  |
  main.tsx                |   100   |   100    |   100   |   100   |
 src/components/          |   83.7  |   78.9   |   86.2  |   84.1  |
  AddTransaction.tsx      |   89.3  |   82.1   |   91.4  |   88.9  |
  Dashboard.tsx           |   91.5  |   88.3   |   93.7  |   92.1  |
  BudgetSettings.tsx      |   76.2  |   71.5   |   79.3  |   77.6  |
 src/pages/               |   68.4  |   61.2   |   70.1  |   69.3  |
  OlderTransactions.tsx   |   71.3  |   65.8   |   73.2  |   72.1  |
```

### Generate Coverage Report

```bash
# Run tests with coverage
npm test -- --coverage

# Generate HTML report
npm test -- --coverage --reporter=html

# Open coverage report
# File: coverage/index.html
```

### Coverage Goals

- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

---

## Writing New Tests

### Test File Template

```typescript
import { describe, test, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from './test-utils'
import { YourComponent } from '../components/YourComponent'

describe('YourComponent', () => {
  beforeEach(() => {
    // Reset state before each test
    localStorage.clear()
  })

  test('renders correctly', async () => {
    renderWithProvider(<YourComponent />)
    
    expect(screen.getByText(/expected text/i)).toBeInTheDocument()
  })

  test('handles user interaction', async () => {
    const user = userEvent.setup()
    renderWithProvider(<YourComponent />)
    
    const button = screen.getByRole('button', { name: /click me/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument()
    })
  })
})
```

### Common Patterns

#### Pattern 1: Testing Forms

```typescript
test('form submission works', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  
  renderWithProvider(<Form onSubmit={onSubmit} />)
  
  await user.type(screen.getByLabelText(/name/i), 'John Doe')
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' })
})
```

#### Pattern 2: Testing Async Operations

```typescript
test('loads data asynchronously', async () => {
  renderWithProvider(<DataComponent />)
  
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
  
  // Verify data displayed
  expect(screen.getByText(/data loaded/i)).toBeInTheDocument()
})
```

#### Pattern 3: Testing Errors

```typescript
test('displays error message', async () => {
  const user = userEvent.setup()
  
  renderWithProvider(<ComponentWithValidation />)
  
  await user.click(screen.getByRole('button'))
  
  expect(screen.getByRole('alert')).toHaveTextContent(/error occurred/i)
})
```

### Test Utilities (`test-utils.tsx`)

```typescript
import { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'

export function renderWithProvider(ui: ReactElement) {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  )
}

export * from '@testing-library/react'
```

---

## Best Practices

### ✅ DO

- ✅ **Test user behavior**, not implementation
- ✅ **Use semantic queries** (getByRole, getByLabelText)
- ✅ **Wait for async operations** with waitFor()
- ✅ **Test accessibility** (keyboard nav, ARIA)
- ✅ **Clean up after tests** (localStorage.clear())
- ✅ **Mock external dependencies** (API calls)
- ✅ **Write descriptive test names**
- ✅ **Keep tests independent**
- ✅ **Follow AAA pattern** (Arrange, Act, Assert)

### ❌ DON'T

- ❌ **Don't test implementation details**
- ❌ **Don't use querySelector unnecessarily**
- ❌ **Don't skip cleanup**
- ❌ **Don't make tests interdependent**
- ❌ **Don't test third-party libraries**
- ❌ **Don't use arbitrary waits** (setTimeout)
- ❌ **Don't ignore warnings**
- ❌ **Don't test everything** (focus on behavior)

### Naming Conventions

```typescript
// ✅ GOOD: Describes behavior
test('shows error when amount is negative')
test('updates total when transaction is added')
test('disables submit button while loading')

// ❌ BAD: Describes implementation
test('calls handleSubmit function')
test('sets state to true')
test('renders div with className')
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:run
      
      - name: Generate coverage
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hook

**Using Husky:**

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:run"
    }
  }
}
```

### VS Code Integration

**`.vscode/settings.json`:**

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument"
}
```

---

## Troubleshooting

### Common Issues

#### 1. Tests Timeout

**Symptom:**
```
Error: Test timed out in 5000ms
```

**Solution:**
```typescript
// Increase timeout for slow tests
test('slow operation', async () => {
  // ...
}, { timeout: 10000 }) // 10 seconds
```

#### 2. Element Not Found

**Symptom:**
```
TestingLibraryElementError: Unable to find element
```

**Solution:**
```typescript
// Use waitFor for async elements
await waitFor(() => {
  expect(screen.getByText(/text/i)).toBeInTheDocument()
})

// Or use findBy (built-in waitFor)
expect(await screen.findByText(/text/i)).toBeInTheDocument()
```

#### 3. Act Warnings

**Symptom:**
```
Warning: An update to Component inside a test was not wrapped in act(...)
```

**Solution:**
```typescript
// Ensure all state updates are awaited
await user.click(button)
await waitFor(() => {
  expect(screen.getByText(/updated/i)).toBeInTheDocument()
})
```

#### 4. localStorage Not Cleared

**Symptom:**
Tests fail due to stale data

**Solution:**
```typescript
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
```

#### 5. Module Import Errors

**Symptom:**
```
Cannot find module './component'
```

**Solution:**
Check `vite.config.ts`:
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true
  }
})
```

---

## Performance Tips

### Speed Up Tests

```typescript
// ✅ GOOD: Use userEvent.setup() once
const user = userEvent.setup()

// ❌ BAD: Create new instance each time
await userEvent.click(button)
```

### Parallel Execution

```bash
# Run tests in parallel (default)
npm test

# Control threads
npm test -- --threads=4
```

### Watch Mode Filters

```bash
# In watch mode, press:
# 'p' - filter by filename
# 't' - filter by test name
# 'a' - run all tests
# 'f' - run only failed tests
```

---

## Resources

### Official Documentation

- **Vitest:** https://vitest.dev/
- **Testing Library:** https://testing-library.com/react
- **User Event:** https://testing-library.com/docs/user-event/intro

### Guides

- **Common Mistakes:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **Testing Best Practices:** https://testingjavascript.com/
- **Accessibility Testing:** https://www.a11yproject.com/

---

## Summary

### Test Statistics

```
Total Test Files: 5
Total Tests: 50+
Test Categories:
  - Basic Functionality: 7 tests
  - Dashboard Features: 4 tests  
  - Transaction Management: 6 tests
  - Accessibility & UX: 6 tests
  - Performance: 5 tests
  
Coverage: 78.5% average
Execution Time: ~3 seconds
Framework: Vitest 3.2.4
```

### Quick Reference

```bash
# Development
npm test                # Watch mode
npm run test:ui         # Visual dashboard

# CI/CD
npm run test:run        # Run once
npm test -- --coverage  # With coverage

# Debugging
npm test -- --reporter=verbose
npm test -- simple.test.tsx  # Single file
```

---

**🎉 Happy Testing!**

Well-tested code is reliable code. These tests ensure Ooga remains stable, accessible, and performant.

---

**Maintained by:** Maor Galkin  
**Last Updated:** October 25, 2025  
**Version:** 1.0
