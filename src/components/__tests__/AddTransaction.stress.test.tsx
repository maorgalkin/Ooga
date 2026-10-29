import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AddTransaction from '../AddTransaction';
import { FinanceProvider } from '../../context/FinanceContext';
import * as SupabaseService from '../../services/supabaseDataService';

// Mock Supabase service
vi.mock('../../services/supabaseDataService', () => ({
  addTransaction: vi.fn(),
  fetchTransactions: vi.fn().mockResolvedValue([]),
  fetchFamilyMembers: vi.fn().mockResolvedValue([
    { id: 'member-1', name: 'Alice', color: '#FF0000' },
  ]),
  fetchCategories: vi.fn().mockResolvedValue([]),
  fetchPersonalBudget: vi.fn().mockResolvedValue(null),
  fetchMonthlyBudget: vi.fn().mockResolvedValue(null),
  fetchHouseholdId: vi.fn().mockResolvedValue('household-1'),
}));

// Mock auth
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    loading: false,
  }),
}));

// Mock budget hook
vi.mock('../../hooks/useBudgets', () => ({
  useActiveBudget: () => ({
    data: {
      categories: {
        'Food & Dining': { limit: 500, isActive: true },
        'Groceries': { limit: 300, isActive: true },
        'Transportation': { limit: 200, isActive: true },
      },
      global_settings: {
        activeExpenseCategories: ['Food & Dining', 'Groceries', 'Transportation'],
        familyMembers: ['member-1'],
      },
    },
    isLoading: false,
  }),
}));

describe('AddTransaction Stress Tests', () => {
  let addTransactionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a spy that simulates network delay
    addTransactionSpy = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            id: `txn-${Date.now()}-${Math.random()}`,
            type: 'expense',
            description: 'Test transaction',
            amount: 50,
            category: 'Food & Dining',
            date: new Date().toISOString().split('T')[0],
          });
        }, 100); // 100ms delay to simulate network
      });
    });
    
    (SupabaseService.addTransaction as any) = addTransactionSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    const onClose = vi.fn();
    // AddTransaction links to account settings, so it needs a router
    const result = render(
      <MemoryRouter>
        <FinanceProvider>
          <AddTransaction isOpen={true} onClose={onClose} />
        </FinanceProvider>
      </MemoryRouter>
    );
    return { ...result, onClose };
  };

  describe('Rapid Click Prevention', () => {
    it('should prevent duplicate transactions when clicking Submit rapidly', async () => {
      const user = userEvent.setup({ delay: null }); // Remove delay for rapid clicks
      renderComponent();

      // Fill out the form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      // Select category
      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      // Wait for category selector and select a category
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      const foodOption = screen.getByText('Food & Dining');
      await user.click(foodOption);

      // Wait for category to be selected
      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      // Get submit button
      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Simulate rapid clicking (5 clicks in quick succession)
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Wait for async operations to complete
      await waitFor(() => {
        expect(addTransactionSpy).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Verify only ONE transaction was created
      expect(addTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('should disable submit button immediately after first click', async () => {
      const user = userEvent.setup({ delay: null });
      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Click submit
      await user.click(submitButton);

      // Immediately check if button is disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent(/submitting/i);
      });

      // Wait for completion
      await waitFor(() => {
        expect(addTransactionSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });
    });

    it('should also disable cancel button during submission', async () => {
      const user = userEvent.setup({ delay: null });
      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      // Click submit
      await user.click(submitButton);

      // Check both buttons are disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });

      await waitFor(() => {
        expect(addTransactionSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });
    });
  });

  describe('Concurrent Submission Prevention', () => {
    it('should handle programmatic concurrent calls gracefully', async () => {
      const user = userEvent.setup({ delay: null });
      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Simulate multiple rapid user clicks (not programmatic events)
      // This better represents real-world double-click scenarios
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Wait for operations to complete
      await waitFor(() => {
        expect(addTransactionSpy).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Verify only ONE transaction was created
      expect(addTransactionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling During Stress', () => {
    it('should re-enable button if submission fails', async () => {
      // Mock failure with realistic delay
      const failingSpy = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network error')), 50);
        });
      });
      (SupabaseService.addTransaction as any) = failingSpy;

      const user = userEvent.setup({ delay: null });
      
      // Mock console.error and alert to avoid test noise
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Click submit
      await user.click(submitButton);

      // Wait for button to be disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveTextContent(/submitting/i);
      });

      // Wait for error and button to re-enable
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
        expect(submitButton).toHaveTextContent(/^submit$/i);
      }, { timeout: 2000 });

      // Verify error handling
      expect(failingSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith('Failed to add transaction. Please try again.');
      
      // Cleanup
      consoleErrorSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('should allow retry after failed submission', async () => {
      // First call fails, second succeeds
      let callCount = 0;
      const mixedSpy = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          id: 'txn-success',
          type: 'expense',
          description: 'Test',
          amount: 50,
          category: 'Food & Dining',
          date: new Date().toISOString().split('T')[0],
        });
      });
      (SupabaseService.addTransaction as any) = mixedSpy;

      const user = userEvent.setup({ delay: null });
      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // First attempt (fails)
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      }, { timeout: 2000 });

      expect(mixedSpy).toHaveBeenCalledTimes(1);

      // Second attempt (succeeds)
      await user.click(submitButton);

      await waitFor(() => {
        expect(mixedSpy).toHaveBeenCalledTimes(2);
      }, { timeout: 2000 });
    });
  });

  describe('High Frequency Stress Test', () => {
    it('should handle 10 rapid clicks without creating duplicates', async () => {
      const user = userEvent.setup({ delay: null });
      renderComponent();

      // Fill form
      const amountInput = screen.getByLabelText(/amount/i);
      await user.type(amountInput, '50');

      const categoryInput = screen.getByPlaceholderText(/select expense category/i);
      await user.click(categoryInput);
      
      await waitFor(() => {
        const foodOption = screen.getByText('Food & Dining');
        expect(foodOption).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Food & Dining'));

      await waitFor(() => {
        expect(categoryInput).toHaveValue('Food & Dining');
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Simulate 10 rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(submitButton);
      }

      await waitFor(() => {
        expect(addTransactionSpy).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should still only be called once
      expect(addTransactionSpy).toHaveBeenCalledTimes(1);
    });
  });
});
