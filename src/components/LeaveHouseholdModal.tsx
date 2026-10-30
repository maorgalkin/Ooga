import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Home, Loader2, CheckCircle } from 'lucide-react';
import * as HouseholdService from '../services/householdService';
import { Trans } from 'react-i18next';
import { useT } from '../hooks/useT';
import i18n from '../i18n';

interface LeaveHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveHouseholdModal: React.FC<LeaveHouseholdModalProps> = ({ isOpen, onClose }) => {
  const t = useT();
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
      // i18n.t, not the hook's t: this runs from the open effect, and these strings have no gendered forms
      setCurrentHouseholdName(household?.name || i18n.t('household.leave.yourHousehold'));
      
      // Auto-suggest name
      const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
      const firstName = user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0];
      // Without a name the old fallback read "My's New Household"
      setNewHouseholdName(firstName ? i18n.t('household.leave.suggestedName', { name: firstName }) : i18n.t('household.leave.suggestedNameNoName'));
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
      setError(err.message || t('household.leave.failed'));
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
              {t('household.leave.createdTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('household.welcomeRedirect')}
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
              <h2 className="text-xl font-semibold text-white">{t('household.leave.title')}</h2>
            </div>
            <button
              onClick={handleCancel}
              aria-label={t('common.close')}
              className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            <Trans i18nKey="household.leave.intro" values={{ name: currentHouseholdName }} components={{ strong: <strong /> }} />
          </p>

          {/* Warning for owners */}
          {isOwner && (
            <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-800 dark:text-orange-200 font-medium mb-2">
                    {isSoleOwner ? t('household.leave.warnAll') : t('household.leave.warnHousehold')}
                  </p>
                  <p className="text-orange-700 dark:text-orange-300 text-sm">
                    {isSoleOwner ? (
                      <>
                        <Trans i18nKey="household.leave.soleOwner" components={{ strong: <strong /> }} />
                      </>
                    ) : (
                      <>
                        <Trans i18nKey="household.leave.ownerAll" components={{ strong: <strong /> }} />
                      </>
                    )}
                  </p>
                  <ul className="mt-2 text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                    <li>{t('household.dataList.transactions')}</li>
                    <li>{t('household.dataList.budgets')}</li>
                    <li>{t('household.dataList.monthly')}</li>
                    <li>{t('household.dataList.familyMembers')}</li>
                    <li>{t('household.dataList.settings')}</li>
                  </ul>
                  {!isSoleOwner && (
                    <p className="mt-2 text-sm text-orange-800 dark:text-orange-200 font-medium">
                      {t('household.leave.transferTip')}
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
                {t('household.leave.memberNote')}
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
              {t('household.leave.nameLabel')}
            </label>
            <input
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              placeholder={t('household.leave.namePlaceholder')}
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
              {t('common.cancel')}
            </button>
            <button
              onClick={handleLeaveAndCreate}
              disabled={loading || !newHouseholdName.trim()}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:bg-orange-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('household.leave.processing')}
                </>
              ) : (
                <>
                  <Home className="h-4 w-4" />
                  {isOwner ? t('household.leave.deleteAndCreate') : t('household.leave.leaveAndCreate')}
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            {t('household.leave.footer')}
          </p>
        </div>
      </div>
    </div>
  );
};
