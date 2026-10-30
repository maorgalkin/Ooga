import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Home, Loader2, CheckCircle } from 'lucide-react';
import * as HouseholdService from '../services/householdService';

interface LeaveHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveHouseholdModal: React.FC<LeaveHouseholdModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isSoleOwner, setIsSoleOwner] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [currentHouseholdName, setCurrentHouseholdName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadHouseholdInfo();
    }
  }, [isOpen]);

  const loadHouseholdInfo = async () => {
    try {
      const [role, household, sole] = await Promise.all([
        HouseholdService.getUserRole(),
        HouseholdService.getUserHousehold(),
        HouseholdService.isUserSoleOwner(),
      ]);
      
      setIsOwner(role === 'owner');
      setIsSoleOwner(sole);
      setCurrentHouseholdName(household?.name || 'your household');
      
      // Auto-suggest name
      const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
      const firstName = user?.user_metadata?.first_name || 
                       user?.user_metadata?.full_name?.split(' ')[0] || 
                       'My';
      setNewHouseholdName(`${firstName}'s New Household`);
    } catch (err) {
      console.error('Error loading household info:', err);
    }
  };

  const handleLeaveAndCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      await HouseholdService.leaveAndCreateNewHousehold(newHouseholdName.trim());
      setSuccess(true);
      setTimeout(() => {
        window.location.reload(); // Reload to refresh all household data
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to leave and create new household');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  // Success State
  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              New household created
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome to your new household. Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Home className="h-6 w-6 text-white" />
              <h2 className="text-xl font-semibold text-white">Leave & create new household</h2>
            </div>
            <button
              onClick={handleCancel}
              className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Leave <strong>{currentHouseholdName}</strong> and start fresh with your own household.
          </p>

          {/* Warning for owners */}
          {isOwner && (
            <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-800 dark:text-orange-200 font-medium mb-2">
                    {isSoleOwner ? 'Warning: all data will be deleted' : 'Warning: household will be deleted'}
                  </p>
                  <p className="text-orange-700 dark:text-orange-300 text-sm">
                    {isSoleOwner ? (
                      <>
                        Since you are the only member, your current household and <strong>all its data will be permanently deleted</strong>:
                      </>
                    ) : (
                      <>
                        As the owner, the entire household will be deleted for <strong>all members</strong>. This includes:
                      </>
                    )}
                  </p>
                  <ul className="mt-2 text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                    <li>All transactions</li>
                    <li>Budget configurations</li>
                    <li>Monthly budgets and adjustments</li>
                    <li>Family members</li>
                    <li>All household settings</li>
                  </ul>
                  {!isSoleOwner && (
                    <p className="mt-2 text-sm text-orange-800 dark:text-orange-200 font-medium">
                      💡 Tip: You can transfer ownership to another member instead of deleting the household. Go to Household settings → App Users → "Make owner" button.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning for members/admins */}
          {!isOwner && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                You'll leave the shared household and lose access to its data. You can always be re-invited later.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* New Household Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New household name
            </label>
            <input
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              placeholder="Enter household name"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveAndCreate}
              disabled={loading || !newHouseholdName.trim()}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:bg-orange-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Home className="h-4 w-4" />
                  {isOwner ? 'Delete & create new' : 'Leave & create new'}
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            This action cannot be undone. Your new household will be created immediately.
          </p>
        </div>
      </div>
    </div>
  );
};
