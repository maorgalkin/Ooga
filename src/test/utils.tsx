import React from 'react';
import { render, screen } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { FinanceProvider } from '../context/FinanceContext';
import type { Transaction, FamilyMember } from '../types';

// Note: dummyTransactions file was removed. Using mock data generator instead.

// Test data generators
export const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: Date.now().toString(),
  date: '2025-08-21',
  description: 'Test Transaction',
  category: 'Test Category',
  amount: 100,
  type: 'expense',
  familyMember: 'Test Member',
  ...overrides,
});

export const createMockFamilyMember = (overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  id: Date.now().toString(),
  name: 'Test Member',
  color: '#3B82F6',
  ...overrides,
});

// Custom render with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialTransactions?: Transaction[];
}

export const renderWithProvider = (
  ui: React.ReactElement,
  { initialTransactions = [], ...renderOptions }: CustomRenderOptions = {}
) => {
  // Pre-populate localStorage if initial transactions provided
  if (initialTransactions.length > 0) {
    localStorage.setItem('ooga-transactions', JSON.stringify(initialTransactions));
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <FinanceProvider>{children}</FinanceProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Test data sets - using mock data generators
export const sampleTransactions: Transaction[] = Array.from({ length: 10 }, (_, i) => 
  createMockTransaction({
    id: `sample-${i}`,
    description: `Sample Transaction ${i + 1}`,
    amount: (i + 1) * 50,
    date: `2025-08-${(i % 28) + 1}`,
    category: ['Groceries', 'Entertainment', 'Transport'][i % 3],
  })
);

// Get transactions by month helper (returns empty for now - can be populated with mock data)
export const getTransactionsByMonth = (month: number, year: number): Transaction[] => {
  // Generate mock transactions for the requested month
  return Array.from({ length: 5 }, (_, i) => 
    createMockTransaction({
      id: `month-${month}-${i}`,
      description: `Transaction for ${month}/${year}`,
      date: `${year}-${month.toString().padStart(2, '0')}-${((i * 5) % 28 + 1).toString().padStart(2, '0')}`,
    })
  );
};

// Pre-defined month data
export const augustTransactions = getTransactionsByMonth(8, 2025);
export const julyTransactions = getTransactionsByMonth(7, 2025);
export const juneTransactions = getTransactionsByMonth(6, 2025);

export const largeTransactionDataset = (count: number): Transaction[] => {
  const transactions: Transaction[] = [];
  const categories = ['Groceries', 'Entertainment', 'Transport', 'Healthcare'];
  const types: ('income' | 'expense')[] = ['income', 'expense'];
  const members = ['John', 'Jane', 'Mike', 'Sarah'];

  for (let i = 0; i < count; i++) {
    transactions.push(createMockTransaction({
      id: `transaction-${i}`,
      description: `Transaction ${i + 1}`,
      amount: Math.floor(Math.random() * 1000) + 10,
      type: types[Math.floor(Math.random() * types.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      familyMember: members[Math.floor(Math.random() * members.length)],
      date: new Date(2025, 7, Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
    }));
  }

  return transactions;
};

// Helper functions for common test scenarios
export const addTransactionViaUI = async (user: any, transactionData: Partial<Transaction>) => {
  const {
    description = 'Test Transaction',
    amount = 100,
    type = 'expense',
    category = 'Groceries',
    familyMember,
    date = '2025-08-21',
  } = transactionData;

  // Fill out the form
  if (description) {
    await user.type(screen.getByPlaceholderText(/Enter transaction description/i), description);
  }
  
  if (amount) {
    await user.type(screen.getByPlaceholderText(/0.00/i), amount.toString());
  }
  
  if (type) {
    await user.selectOptions(screen.getByLabelText(/Type/i), type);
  }
  
  if (category) {
    await user.selectOptions(screen.getByLabelText(/Category/i), category);
  }
  
  if (familyMember) {
    await user.selectOptions(screen.getByLabelText(/Family Member/i), familyMember);
  }
  
  if (date) {
    await user.clear(screen.getByLabelText(/Date/i));
    await user.type(screen.getByLabelText(/Date/i), date);
  }

  // Submit the form
  await user.click(screen.getByText(/Submit/i));
};
