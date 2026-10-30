import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import type { Transaction } from '../types';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportTransactionsModal: React.FC<ImportTransactionsModalProps> = ({ isOpen, onClose }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const { setTransactions } = useFinance();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadTestFile = () => {
    // Trigger file input click to open file picker
    const fileInput = document.getElementById('test-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleTestFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const transactions = JSON.parse(e.target?.result as string);
          setTransactions(transactions as Transaction[]);
          alert('Test file loaded successfully!');
          onClose();
        } catch (error) {
          alert('Invalid JSON file. Please check the file content.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (fileContent) {
      try {
        const transactions = JSON.parse(fileContent);
        if (!Array.isArray(transactions) || transactions.length === 0) {
          alert('Imported file is empty or not an array.');
          return;
        }
        setTransactions(transactions as Transaction[]);
        alert('Transactions imported successfully!');
        onClose();
      } catch (error) {
        alert('Invalid JSON file. Please check the file content.');
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isDevMode = import.meta.env.DEV;

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Import Transactions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="mb-4">
          <label htmlFor="import-json" className="block text-sm font-medium text-gray-700 mb-2">
            Import Transactions
          </label>
          <input
            id="import-json"
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        {isDevMode && (
          <>
            {/* Hidden file input for test file loading */}
            <input
              id="test-file-input"
              type="file"
              accept="application/json"
              onChange={handleTestFileChange}
              className="hidden"
            />
            <button
              onClick={handleLoadTestFile}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 w-full mb-4"
            >
              Load Test File
            </button>
          </>
        )}
        <div className="flex justify-end space-x-2 rtl:space-x-reverse">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Import
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImportTransactionsModal;
