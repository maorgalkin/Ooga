import React, { useState, useEffect } from 'react';
import type { Transaction, Budget, FamilyMember } from '../types/index';
import { useAuth } from '../contexts/AuthContext';
import * as SupabaseService from '../services/supabaseDataService';

interface FinanceContextType {
  transactions: Transaction[];
  budgets: Budget[];
  familyMembers: FamilyMember[];
  isLoading: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateBudget: (budget: Budget) => void;
  addFamilyMember: (member: Omit<FamilyMember, 'id'>) => Promise<void>;
  updateFamilyMember: (id: string, member: Omit<FamilyMember, 'id'>) => Promise<void>;
  getTotalIncome: () => number;
  getTotalExpenses: () => number;
  getBalance: () => number;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  refreshTransactions: () => Promise<void>;
}

const FinanceContext = React.createContext<FinanceContextType | undefined>(undefined);

export const useFinance = () => {
  const context = React.useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load data from Supabase when user is authenticated
  useEffect(() => {
    if (!user) {
      // User logged out, clear data
      setTransactions([]);
      setFamilyMembers([]);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load all data from Supabase
        const [txns, members] = await Promise.all([
          SupabaseService.getTransactions(),
          SupabaseService.getFamilyMembers(),
        ]);

        setTransactions(txns);
        
        // Load family members from database
        setFamilyMembers(members);
        // Note: If empty, users can add their own via the app
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
        // Fallback to localStorage in case of error
        const savedTransactions = localStorage.getItem('ooga-transactions');
        const savedMembers = localStorage.getItem('ooga-members');
        
        if (savedTransactions && savedTransactions !== '[]') {
          setTransactions(JSON.parse(savedTransactions));
        }
        if (savedMembers) {
          setFamilyMembers(JSON.parse(savedMembers));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      if (user) {
        const newTransaction = await SupabaseService.addTransaction(transaction);
        setTransactions(prev => [newTransaction, ...prev]);
      } else {
        // Fallback to localStorage if not authenticated
        const newTransaction: Transaction = {
          ...transaction,
          id: Date.now().toString(),
        };
        setTransactions(prev => [newTransaction, ...prev]);
        localStorage.setItem('ooga-transactions', JSON.stringify([newTransaction, ...transactions]));
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert(`Failed to add transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const updateTransaction = async (id: string, transaction: Omit<Transaction, 'id'>) => {
    try {
      if (user) {
        const updatedTransaction = await SupabaseService.updateTransaction(id, transaction);
        setTransactions(prev => 
          prev.map(t => t.id === id ? updatedTransaction : t)
        );
      } else {
        // Fallback to localStorage
        setTransactions(prev => {
          const updated = prev.map(t => t.id === id ? { ...transaction, id } : t);
          localStorage.setItem('ooga-transactions', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      if (user) {
        await SupabaseService.deleteTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
      } else {
        // Fallback to localStorage
        setTransactions(prev => {
          const filtered = prev.filter(t => t.id !== id);
          localStorage.setItem('ooga-transactions', JSON.stringify(filtered));
          return filtered;
        });
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  const updateBudget = (budget: Budget) => {
    setBudgets(prev => {
      const existing = prev.find(b => b.id === budget.id);
      if (existing) {
        return prev.map(b => b.id === budget.id ? budget : b);
      }
      return [...prev, budget];
    });
  };

  const addFamilyMember = async (member: Omit<FamilyMember, 'id'>) => {
    try {
      if (user) {
        const newMember = await SupabaseService.addFamilyMember(member);
        setFamilyMembers(prev => [...prev, newMember]);
      } else {
        // Fallback to localStorage
        const newMember: FamilyMember = {
          ...member,
          id: Date.now().toString(),
        };
        setFamilyMembers(prev => {
          const updated = [...prev, newMember];
          localStorage.setItem('ooga-members', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error adding family member:', error);
      throw error;
    }
  };

  const updateFamilyMember = async (id: string, member: Omit<FamilyMember, 'id'>) => {
    try {
      if (user) {
        const updatedMember = await SupabaseService.updateFamilyMember(id, member);
        setFamilyMembers(prev => prev.map(m => m.id === id ? updatedMember : m));
      } else {
        // Fallback to localStorage
        setFamilyMembers(prev => {
          const updated = prev.map(m => m.id === id ? { ...member, id } : m);
          localStorage.setItem('ooga-members', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error updating family member:', error);
      throw error;
    }
  };

  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getTotalExpenses = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getBalance = () => {
    return getTotalIncome() - getTotalExpenses();
  };

  const refreshTransactions = async () => {
    if (!user) return;
    try {
      const txns = await SupabaseService.getTransactions();
      setTransactions(txns);
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    }
  };

  return (
    <FinanceContext.Provider value={{
      transactions,
      budgets,
      familyMembers,
      isLoading,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      updateBudget,
      addFamilyMember,
      updateFamilyMember,
      getTotalIncome,
      getTotalExpenses,
      getBalance,
      setTransactions,
      refreshTransactions,
    }}>
      {children}
    </FinanceContext.Provider>
  );
};
