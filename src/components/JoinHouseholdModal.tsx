import React, { useState } from 'react';
import { errorMessage } from '../i18n/errors';
import { X, AlertTriangle, Users, Loader2, CheckCircle } from 'lucide-react';
import * as HouseholdService from '../services/householdService';
import { Trans } from 'react-i18next';
import { useT } from '../hooks/useT';

interface JoinHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinHouseholdModal: React.FC<JoinHouseholdModalProps> = ({ isOpen, onClose }) => {
  const t = useT();
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{
    willDeleteData: boolean;
    householdName: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (confirmDeletion: boolean = false) => {
    if (!invitationCode.trim()) {
      setError(t('household.join.enterCode'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await HouseholdService.acceptInvitationAndJoin(
        invitationCode.trim(),
        confirmDeletion
      );

      if (result.success) {
        // Successfully joined
        setSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload(); // Reload to refresh all household-dependent data
        }, 2000);
      } else if (result.willDeleteData && result.householdName) {
        // Show warning about data deletion
        setWarning({
          willDeleteData: true,
          householdName: result.householdName,
        });
        setLoading(false);
      } else {
        // Error occurred
        setError(errorMessage(result.error, t, 'household.join.joinFailed'));
        setLoading(false);
      }
    } catch (err: any) {
      setError(errorMessage(err, t, 'household.join.genericError'));
      setLoading(false);
    }
  };

  const handleConfirmAndJoin = () => {
    setWarning(null);
    handleSubmit(true);
  };

  const handleCancel = () => {
    setInvitationCode('');
    setError(null);
    setWarning(null);
    setSuccess(false);
    onClose();
  };

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
              {t('household.join.successTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('household.welcomeRedirect')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warning State (data will be deleted)
  if (warning) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="bg-red-600 px-6 py-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-white" />
                <h2 className="text-xl font-semibold text-white">{t('household.join.warningTitle')}</h2>
              </div>
              <button
                onClick={handleCancel}
                className="text-white hover:bg-red-700 rounded-lg p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                {t('household.join.aboutToLeave')}
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm">
                <Trans i18nKey="household.join.onlyMember" components={{ strong: <strong /> }} />
              </p>
              <ul className="mt-3 text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>{t('household.dataList.transactions')}</li>
                <li>{t('household.dataList.budgets')}</li>
                <li>{t('household.dataList.monthly')}</li>
                <li>{t('household.dataList.familyMembers')}</li>
                <li>{t('household.dataList.settings')}</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                <Trans i18nKey="household.join.youWillJoin" values={{ name: warning.householdName }} components={{ strong: <strong /> }} />
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                {t('household.join.accessHint')}
              </p>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              <Trans i18nKey="household.join.cannotUndo" components={{ strong: <strong /> }} />
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmAndJoin}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:bg-red-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('household.join.joining')}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    {t('household.join.deleteAndJoin')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal Input State
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-white" />
              <h2 className="text-xl font-semibold text-white">{t('household.join.title')}</h2>
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
            {t('household.join.intro')}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('household.join.codeLabel')}
            </label>
            <input
              type="text"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              placeholder={t('household.join.codePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 font-mono text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('household.join.codeHint')}
            </p>
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
              onClick={() => handleSubmit(false)}
              disabled={loading || !invitationCode.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('household.join.checking')}
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  {t('household.join.title')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
