import React from 'react';
import { Users } from 'lucide-react';

interface FamilyMembersCardProps {
  familyMembersCount: number;
  onOpenModal: () => void;
  householdName?: string;
}

/**
 * Quick access card for managing family members
 */
export const FamilyMembersCard: React.FC<FamilyMembersCardProps> = ({
  familyMembersCount,
  onOpenModal,
  householdName,
}) => {
  return (
    <button
      onClick={onOpenModal}
      className="bg-white dark:bg-purple-900/20 rounded-lg shadow-sm border border-purple-200 dark:border-purple-700 p-4 w-full hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400 me-3" />
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              {householdName || 'Family Members'}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">Click to Manage Your Household</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{familyMembersCount}</p>
      </div>
    </button>
  );
};
