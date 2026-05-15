import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget } from '../hooks/useBudgets';
import { X, HelpCircle, Calendar, Download, Plus } from 'lucide-react';
import CategorySelector from './CategorySelector';
import * as SupabaseService from '../services/supabaseDataService';
import { getUserLocale } from '../utils/locale';
import { listConnections, type BankConnection } from '../services/bankImportService';
import BankImportModal from './BankImportModal';

interface AddTransactionProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddTransaction: React.FC<AddTransactionProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { addTransaction, familyMembers, setTransactions } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState('');
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [importConnectionId, setImportConnectionId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    type: 'expense' as 'income' | 'expense',
    familyMember: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Get active expense categories from user's active budget
  const expenseCategories = useMemo(() => {
    if (!personalBudget) return [];
    
    // Get active categories from global settings
    const activeCategories = personalBudget.global_settings?.activeExpenseCategories || [];
    
    // Filter to only include categories that are both in activeCategories list AND marked as active
    const categories = activeCategories.filter(catName => {
      const categoryConfig = personalBudget.categories[catName];
      return categoryConfig && categoryConfig.isActive !== false;
    });
    
    // Sort alphabetically with "Other" at the end
    return categories
      .filter(cat => cat !== 'Other')
      .sort()
      .concat(categories.includes('Other') ? ['Other'] : []);
  }, [personalBudget]);

  // Income categories - sorted alphabetically with "Other" last
  const incomeCategories = [
    'Gift',
    'Government Allowance',
    'Rent',
    'Salary',
    'Other'
  ];

  // Generate default descriptions for income categories
  const getDefaultDescription = (category: string) => {
    const currentDate = new Date();
    const monthYear = currentDate.toLocaleDateString(getUserLocale(), { month: 'long', year: 'numeric' });
    
    switch (category) {
      case 'Salary':
        return `Salary - ${monthYear}`;
      case 'Rent':
        return `Rental Income - ${monthYear}`;
      case 'Government Allowance':
        return '[Edit: Allowance type] - [Edit: Period]';
      case 'Gift':
        return '[Edit: Gift from whom/occasion]';
      case 'Other':
        return '[Edit: Income source description]';
      default:
        return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Validate all required fields
    const missingFields = [];
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      missingFields.push('Amount');
    }
    
    if (!formData.category) {
      missingFields.push('Category');
    }
    
    if (!formData.date) {
      missingFields.push('Date');
    }
    
    if (isInstallment && (!numberOfInstallments || parseInt(numberOfInstallments) < 2)) {
      missingFields.push('Number of Installments (minimum 2)');
    }
    
    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const totalAmount = parseFloat(formData.amount);
      const installmentCount = isInstallment ? parseInt(numberOfInstallments) : 1;
      const amountPerInstallment = totalAmount / installmentCount;

      const transactionData = {
        type: formData.type,
        description: formData.description || `${formData.category} transaction`,
        amount: amountPerInstallment,
        category: formData.category,
        familyMember: formData.familyMember || undefined,
        date: formData.date,
      };

      if (isInstallment) {
        // Create installment transactions (amount already divided)
        await SupabaseService.addInstallmentTransactions(
          transactionData,
          installmentCount
        );
        // Refresh transactions to show all new installments
        const allTransactions = await SupabaseService.getTransactions();
        setTransactions(allTransactions);
      } else {
        // Regular single transaction
        await addTransaction(transactionData);
      }

      // Reset form
      setFormData({
        type: 'expense',
        description: '',
        amount: '',
        category: '',
        familyMember: '',
        date: new Date().toISOString().split('T')[0],
      });
      setIsInstallment(false);
      setNumberOfInstallments('');

      onClose();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    let updates: any = { category };
    
    // Auto-populate description for income categories
    if (formData.type === 'income' && category) {
      updates.description = getDefaultDescription(category);
    }
    
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let updates: any = { [name]: value };
    
    // Clear category when type changes to avoid invalid combinations
    if (name === 'type') {
      updates.category = '';
      updates.description = '';
      setShowCategorySelector(false); // Close category selector if open
    }
    
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Load bank connections when modal opens
  useEffect(() => {
    if (isOpen) {
      listConnections().then(setConnections).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCategories = formData.type === 'income' ? incomeCategories : expenseCategories;

  const transactionModal = createPortal(
    <div className="fixed inset-0 overflow-y-auto bg-black bg-opacity-50 z-[1000]" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Add {formData.type === 'income' ? '💰 Income' : '💸 Expense'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-x-hidden">
          {/* Import Transactions section */}
          <div className="pb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              Import Transactions
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {connections.map(conn => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => { setImportConnectionId(conn.id); setShowImportModal(true); }}
                  className="flex-shrink-0 w-24 h-16 flex flex-col items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer gap-1"
                >
                  <span className="text-lg">🏦</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center leading-tight px-1 truncate w-full text-center">
                    {conn.display_name}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { onClose(); navigate('/?tab=budget&subtab=settings'); }}
                title="Add a bank account in Settings"
                className="flex-shrink-0 w-24 h-16 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer gap-1"
              >
                <Plus className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Add account</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {/* Expense Option */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  type: 'expense',
                  category: prev.type !== 'expense' ? '' : prev.category // Reset category only if type changes
                }))}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors focus:outline-none ${
                  formData.type === 'expense' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                💸 Expense
              </button>
              
              {/* Income Option */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  type: 'income',
                  category: prev.type !== 'income' ? '' : prev.category // Reset category only if type changes
                }))}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors focus:outline-none border-l border-gray-300 ${
                  formData.type === 'income' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                💰 Income
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              {formData.type === 'income' ? 'Income' : 'Expense'} Categories
            </label>
            <div className="relative">
              <input
                id="category"
                type="text"
                value={formData.category}
                readOnly
                placeholder={formData.type === 'income' ? 'Select income source' : 'Select expense category'}
                className="w-full px-3 py-2 pr-24 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                onClick={() => setShowCategorySelector(true)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCategorySelector(true)}
                className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Choose
              </button>
            </div>

          </div>

          <div>
            <label htmlFor="transaction-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-xs text-gray-500">(optional)</span>
            </label>
            <input
              id="transaction-description"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter transaction description (optional)"
            />
          </div>

          <div>
            <label htmlFor="transaction-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              id="transaction-amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label htmlFor="transaction-family-member" className="block text-sm font-medium text-gray-700 mb-1">
              Family Member
            </label>
            <select
              id="transaction-family-member"
              name="familyMember"
              value={formData.familyMember}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select family member (optional)</option>
              {familyMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="transaction-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="transaction-date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Installments Section - Reserve space to keep modal height consistent */}
          <div className="border-t border-gray-200 pt-4" style={{ minHeight: '52px' }}>
            {formData.type === 'expense' && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <input
                    id="installments-checkbox"
                    type="checkbox"
                    checked={isInstallment}
                    onChange={(e) => {
                      setIsInstallment(e.target.checked);
                      if (!e.target.checked) setNumberOfInstallments('');
                    }}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="installments-checkbox" className="flex items-center text-sm font-medium text-gray-700 whitespace-nowrap">
                    <Calendar className="h-4 w-4 mr-1" />
                    Create as installments
                  </label>
                </div>
                
                {isInstallment && (
                  <input
                    id="installments-count"
                    type="number"
                    min="2"
                    max="36"
                    value={numberOfInstallments}
                    onChange={(e) => setNumberOfInstallments(e.target.value)}
                    placeholder="# months"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={isInstallment}
                  />
                )}
                
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                    Amount will be divided equally across installments. Transactions created on 1st of each month (2-36 months).
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Render CategorySelector separately so it doesn't interfere with the main modal
  const categorySelector = showCategorySelector ? (
    <CategorySelector
      isOpen={showCategorySelector}
      onClose={() => setShowCategorySelector(false)}
      onSelect={handleCategorySelect}
      categories={currentCategories}
      type={formData.type}
    />
  ) : null;

  return (
    <>
      {transactionModal}
      {categorySelector}
      {showImportModal && (
        <BankImportModal
          onClose={() => setShowImportModal(false)}
          selectedConnectionId={importConnectionId ?? undefined}
        />
      )}
    </>
  );
};

export default AddTransaction;
