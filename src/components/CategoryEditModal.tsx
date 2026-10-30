import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { BudgetConfiguration } from '../types';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  category: BudgetConfiguration['categories'][string];
  currency: string;
  onSave: (updates: Partial<BudgetConfiguration['categories'][string]>) => void;
  onDelete: () => void;
  onCancel?: () => void; // New prop for handling cancel of new categories
  hasTransactions?: boolean; // Whether category has existing transactions
  transactionCount?: number; // Number of transactions for this category
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  category,
  currency,
  onSave,
  onDelete,
  onCancel,
  hasTransactions = false,
  transactionCount = 0,
}) => {
  const [monthlyLimit, setMonthlyLimit] = useState(category.monthlyLimit.toString());
  const [warningThreshold, setWarningThreshold] = useState(category.warningThreshold);
  const [isActive, setIsActive] = useState(category.isActive);
  const [color, setColor] = useState(category.color || '#64748B');
  const [description, setDescription] = useState(category.description || '');

  if (!isOpen) return null;

  const canDeactivate = !hasTransactions || !isActive;
  const deactivationMessage = hasTransactions 
    ? `Cannot deactivate: This category has ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}` 
    : '';

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'USD': return '$';
      case 'ILS': return '₪';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return curr;
    }
  };

  const handleSave = () => {
    onSave({
      monthlyLimit: parseFloat(monthlyLimit) || 0,
      warningThreshold,
      isActive,
      color,
      description,
    });
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel(); // Call onCancel if provided (for new categories)
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const handleMonthlyLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMonthlyLimit(e.target.value);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{categoryName}</h2>
            <p className="text-sm text-gray-500">Configure budget settings for this category</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-900">Active</label>
              <p className="text-xs text-gray-500">Enable budget tracking for this category</p>
              {!canDeactivate && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{deactivationMessage}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (canDeactivate) {
                  setIsActive(!isActive);
                }
              }}
              disabled={!canDeactivate && isActive}
              title={!canDeactivate && isActive ? deactivationMessage : ''}
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                isActive ? 'bg-blue-600' : 'bg-gray-300'
              } ${!canDeactivate && isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-1 rtl:-translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Monthly Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Budget Limit
            </label>
            <div className="relative flex items-center">
              <span className="absolute start-3 text-gray-500 pointer-events-none">
                {getCurrencySymbol(currency)}
              </span>
              <input
                type="number"
                value={monthlyLimit || ''}
                onChange={handleMonthlyLimitChange}
                className="block w-full ps-8 pe-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Maximum amount to spend in this category per month</p>
          </div>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning Threshold ({warningThreshold}%)
            </label>
            <input
              type="range"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(Number(e.target.value))}
              min="0"
              max="100"
              step="5"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Get notified when spending reaches {warningThreshold}% of your budget
            </p>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#64748B"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Choose a color for charts and visualizations</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add notes about this category..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            Delete Category
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryEditModal;
