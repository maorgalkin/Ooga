// Budget Settings Component
// Part of Category Management Restructure (Phase 5)
// Consolidates Global Settings, Family Members, and Household Management

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  DollarSign, 
  Bell, 
  Mail, 
  Users, 
  Home,
  Save,
  Loader2,
  Check,
  FileText,
  Edit2
} from 'lucide-react';
import { BudgetHistory } from './BudgetHistory';
import { useActiveBudget, useUpdatePersonalBudget } from '../../hooks/useBudgets';
import ConnectedAccountsSettings from '../ConnectedAccountsSettings';
import HouseholdSettingsModal from '../HouseholdSettingsModal';
import * as HouseholdService from '../../services/householdService';
import type { Household } from '../../services/householdService';

interface BudgetSettingsProps {
  className?: string;
}

export const BudgetSettings: React.FC<BudgetSettingsProps> = ({ className = '' }) => {
  const { data: activeBudget, isLoading: loadingBudget } = useActiveBudget();
  const updateBudget = useUpdatePersonalBudget();
  
  // Global settings state
  const [currency, setCurrency] = useState('ILS');
  const [warningNotifications, setWarningNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [showExactAmounts, setShowExactAmounts] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Budget name state
  const [budgetName, setBudgetName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  
  // Household state
  const [household, setHousehold] = useState<Household | null>(null);
  const [loadingHousehold, setLoadingHousehold] = useState(true);
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);

  // Load settings from active budget
  useEffect(() => {
    if (activeBudget) {
      setBudgetName(activeBudget.name || '');
      if (activeBudget.global_settings) {
        setCurrency(activeBudget.global_settings.currency || 'ILS');
        setWarningNotifications(activeBudget.global_settings.warningNotifications ?? true);
        setEmailAlerts(activeBudget.global_settings.emailAlerts ?? false);
        // Invert: showRoundedAmounts in DB (true=rounded) becomes showExactAmounts in UI (false=rounded)
        setShowExactAmounts(!(activeBudget.global_settings.showRoundedAmounts ?? true));
      }
      setHasChanges(false);
    }
  }, [activeBudget]);

  // Load household data
  useEffect(() => {
    const loadHousehold = async () => {
      try {
        const data = await HouseholdService.getUserHousehold();
        setHousehold(data);
      } catch (error) {
        console.error('Error loading household:', error);
      } finally {
        setLoadingHousehold(false);
      }
    };
    loadHousehold();
  }, [showHouseholdModal]); // Reload when modal closes

  const handleSaveSettings = async () => {
    if (!activeBudget) return;

    try {
      const updatedGlobalSettings = {
        ...activeBudget.global_settings,
        currency,
        warningNotifications,
        emailAlerts,
        // Invert: UI showExactAmounts (false=rounded) becomes DB showRoundedAmounts (true=rounded)
        showRoundedAmounts: !showExactAmounts,
      };

      await updateBudget.mutateAsync({
        budgetId: activeBudget.id,
        updates: {
          name: budgetName.trim() || activeBudget.name,
          global_settings: updatedGlobalSettings,
        },
      });

      setHasChanges(false);
      setIsEditingName(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleSettingChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasChanges(true);
    setSaveSuccess(false);
  };
  
  const handleNameChange = (value: string) => {
    setBudgetName(value);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      ILS: '₪',
      JPY: '¥',
    };
    return symbols[curr] || curr;
  };

  if (loadingBudget) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!activeBudget) {
    return (
      <div className="text-center py-12">
        <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Create a budget first to configure settings
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Budget Settings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure your budget preferences and household
          </p>
        </div>
        
        {hasChanges && (
          <button
            onClick={handleSaveSettings}
            disabled={updateBudget.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {updateBudget.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        )}
        
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">Saved!</span>
          </div>
        )}
      </div>

      {/* Main Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        
        {/* Budget Name Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Budget Name</h4>
                {isEditingName ? (
                  <input
                    type="text"
                    value={budgetName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => !hasChanges && setIsEditingName(false)}
                    autoFocus
                    className="mt-1 w-full max-w-xs px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Summer 2025 Budget"
                  />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {budgetName || 'Unnamed budget'}
                    <span className="ml-2 text-xs text-gray-400">v{activeBudget?.version}</span>
                  </p>
                )}
              </div>
            </div>
            {!isEditingName && (
              <button
                onClick={() => setIsEditingName(true)}
                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                title="Rename budget"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Household Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Home className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Household</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {loadingHousehold ? 'Loading...' : household ? (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {household.name}
                    </span>
                  ) : 'Not configured'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHouseholdModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              {household ? 'Manage' : 'Set Up'}
            </button>
          </div>
        </div>

        {/* Currency Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Currency</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Display format for amounts
                </p>
              </div>
            </div>
            <select
              value={currency}
              onChange={(e) => handleSettingChange(setCurrency, e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="USD">{getCurrencySymbol('USD')} USD</option>
              <option value="EUR">{getCurrencySymbol('EUR')} EUR</option>
              <option value="GBP">{getCurrencySymbol('GBP')} GBP</option>
              <option value="ILS">{getCurrencySymbol('ILS')} ILS</option>
              <option value="JPY">{getCurrencySymbol('JPY')} JPY</option>
            </select>
          </div>
        </div>

        {/* Warning Notifications Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Budget Warnings</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Alert when approaching category limits
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={warningNotifications}
                onChange={(e) => handleSettingChange(setWarningNotifications, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        {/* Email Alerts Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Email Alerts</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive email for important budget events
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => handleSettingChange(setEmailAlerts, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        {/* Exact Amounts Row */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Exact Amounts</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show amounts with decimal precision
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showExactAmounts}
                onChange={(e) => handleSettingChange(setShowExactAmounts, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Connected Bank Accounts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <ConnectedAccountsSettings />
      </div>

      {/* Budget History Section */}
      <BudgetHistory currency={currency} />

      {/* Household Settings Modal */}
      <HouseholdSettingsModal
        isOpen={showHouseholdModal}
        onClose={() => setShowHouseholdModal(false)}
      />
    </div>
  );
};
