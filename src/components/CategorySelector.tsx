import React from 'react';
import { createPortal } from 'react-dom';
import { getCategoryColor } from '../utils/categoryColors';
import { getCategoryIcon } from '../utils/categoryIcons';
import { useActiveBudget } from '../hooks/useBudgets';

interface CategorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (category: string) => void;
  categories: string[];
  type: 'income' | 'expense';
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  categories,
  type
}) => {
  const { data: personalBudget } = useActiveBudget();
  
  if (!isOpen) return null;

  const handleCategoryClick = (category: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onSelect(category);
    onClose();
  };

  const handleModalClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[1001] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={handleModalClick}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Select {type === 'income' ? 'income source' : 'expense category'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose from your categories below
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((category) => {
              const categoryColors = getCategoryColor(category, type, personalBudget);
              const icon = getCategoryIcon(category);
              return (
                <button
                  key={category}
                  onClick={(event) => handleCategoryClick(category, event)}
                  className="border-2 rounded-lg p-4 text-start transition-all duration-200 hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 group"
                  style={{
                    backgroundColor: categoryColors.tile,
                    borderColor: categoryColors.border
                  }}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="text-3xl group-hover:scale-110 transition-transform">
                      {icon}
                    </div>
                    <span 
                      className="text-sm font-medium leading-tight"
                      style={{ color: categoryColors.text }}
                    >
                      {category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            {type === 'income' ? 
              'Select the source of your income' : 
              'Select the category that best describes your expense'
            }
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CategorySelector;
