import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Home, Users, UserPlus, Crown, User as UserIcon, Trash2, Copy, Check, LogOut, UserCheck, Plus, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as HouseholdService from '../services/householdService';
import * as SupabaseDataService from '../services/supabaseDataService';
import type { Household, HouseholdMember } from '../services/householdService';
import type { FamilyMember } from '../types';
import { JoinHouseholdModal } from './JoinHouseholdModal';
import { LeaveHouseholdModal } from './LeaveHouseholdModal';
import { getUserLocale } from '../utils/locale';

interface HouseholdSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HouseholdSettingsModal: React.FC<HouseholdSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'participant' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingHouseholdName, setIsEditingHouseholdName] = useState(false);
  const [editedHouseholdName, setEditedHouseholdName] = useState('');
  
  // Invitation code states
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Modal states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  // Edit tag modal states
  const [editingTag, setEditingTag] = useState<FamilyMember | null>(null);
  const [editedTagName, setEditedTagName] = useState('');
  const [editedTagColor, setEditedTagColor] = useState('');
  const [editedTagLinkedMember, setEditedTagLinkedMember] = useState<string>(''); // household_member_id or empty for unlinked

  useEffect(() => {
    if (isOpen) {
      loadHouseholdData();
      loadInvitationCode();
    }
  }, [isOpen]);

  const loadHouseholdData = async () => {
    setIsLoading(true);
    try {
      const [householdData, membersData, familyMembersData, role] = await Promise.all([
        HouseholdService.getUserHousehold(),
        HouseholdService.getHouseholdMembers(),
        SupabaseDataService.getFamilyMembers(),
        HouseholdService.getUserRole(),
      ]);
      
      setHousehold(householdData);
      setEditedHouseholdName(householdData?.name || '');
      setMembers(membersData);
      setFamilyMembers(familyMembersData);
      setUserRole(role);
    } catch (error) {
      console.error('Error loading household data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvitationCode = async () => {
    try {
      const code = await HouseholdService.generateInvitationCode();
      setInvitationCode(code);
    } catch (error) {
      console.error('Error generating invitation code:', error);
      setInvitationCode('');
    }
  };

  const handleCopyInvitationCode = () => {
    if (invitationCode) {
      navigator.clipboard.writeText(invitationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleUpdateName = async () => {
    if (!household || !editedHouseholdName.trim()) return;
    
    try {
      await HouseholdService.updateHouseholdName(household.id, editedHouseholdName.trim());
      setHousehold({ ...household, name: editedHouseholdName.trim() });
      setIsEditingHouseholdName(false);
    } catch (error) {
      console.error('Error updating household name:', error);
      alert('Failed to update household name');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await HouseholdService.removeMember(memberId);
      await loadHouseholdData();  // Reload both members and family members
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleAddCustomTag = async () => {
    const tagName = prompt('Enter name for new household member tag:');
    if (!tagName || !tagName.trim()) return;

    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
      await SupabaseDataService.addFamilyMember({
        name: tagName.trim(),
        color: randomColor,
        household_member_id: null,  // Custom tag, not linked to any participant
      });
      await loadHouseholdData();
    } catch (error) {
      console.error('Error adding custom tag:', error);
      alert('Failed to add custom tag');
    }
  };

  const handleEditTag = (tag: FamilyMember) => {
    setEditingTag(tag);
    setEditedTagName(tag.name);
    setEditedTagColor(tag.color);
    setEditedTagLinkedMember(tag.household_member_id || '');
  };

  const handleSaveTagEdit = async () => {
    if (!editingTag || !editedTagName.trim()) return;

    try {
      await SupabaseDataService.updateFamilyMember(editingTag.id, {
        name: editedTagName.trim(),
        color: editedTagColor,
        household_member_id: editedTagLinkedMember || null,
      });
      await loadHouseholdData();
      setEditingTag(null);
    } catch (error) {
      console.error('Error updating tag:', error);
      alert('Failed to update tag');
    }
  };

  const handleDeleteTagFromModal = async () => {
    if (!editingTag) return;
    if (!confirm('Are you sure you want to delete this tag?')) return;

    try {
      await SupabaseDataService.deleteFamilyMember(editingTag.id);
      await loadHouseholdData();
      setEditingTag(null);
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Failed to delete tag');
    }
  };

  const handleTransferOwnership = async (memberId: string, memberName: string) => {
    const confirmed = confirm(
      `Transfer ownership to ${memberName}?\n\n` +
      `You will become a budget participant and ${memberName} will become the owner. ` +
      `This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      await HouseholdService.transferOwnership(memberId);
      await loadHouseholdData();
      alert(`Ownership successfully transferred to ${memberName}`);
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      alert(error.message || 'Failed to transfer ownership');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'participant':
        return <UserIcon className="h-4 w-4 text-blue-600" />;
      default:
        return <UserIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
      participant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'participant':
        return 'Budget participant';
      default:
        return 'Budget participant';
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const canManageMembers = userRole === 'owner';  // Only owners can manage participants now

  const content = (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={handleBackdropClick}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Home className="h-5 w-5 sm:h-6 sm:w-6 text-white flex-shrink-0" />
              <h2 className="text-lg sm:text-xl font-semibold text-white truncate">Household settings</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-1.5 sm:p-2 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
            ) : (
              <>
                {/* Household Members Section - Using actual household name */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                    {isEditingHouseholdName ? (
                      <div className="flex flex-col sm:flex-row gap-2 flex-1">
                        <input
                          type="text"
                          value={editedHouseholdName}
                          onChange={(e) => setEditedHouseholdName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-semibold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateName();
                            if (e.key === 'Escape') {
                              setIsEditingHouseholdName(false);
                              setEditedHouseholdName(household?.name || '');
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateName}
                            className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingHouseholdName(false);
                              setEditedHouseholdName(household?.name || '');
                            }}
                            className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                          <Users className="h-5 w-5 me-2 flex-shrink-0" />
                          <span className="break-words">{household?.name}</span>
                        </h3>
                        {userRole === 'owner' && (
                          <button
                            onClick={() => setIsEditingHouseholdName(true)}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline self-start sm:self-auto"
                          >
                            Edit
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Members List with their tags */}
                  <div className="space-y-2 mb-4">
                    {members.map((member) => {
                      const isCurrentUser = member.user_id === user?.id;
                      const canManageThisMember = canManageMembers && !isCurrentUser && member.role !== 'owner';
                      const canTransferToThisMember = userRole === 'owner' && !isCurrentUser && member.role !== 'owner';
                      const memberTag = familyMembers.find(fm => fm.household_member_id === member.id);

                      return (
                        <div
                          key={member.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              {getRoleIcon(member.role)}
                            </div>
                            {memberTag && (
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: memberTag.color }}
                                title={`Transaction tag: ${memberTag.name}`}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100 break-words">
                                  {isCurrentUser ? 'You' : (member.email || member.user_id.substring(0, 8))}
                                  {memberTag && ` (${memberTag.name})`}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${getRoleBadge(member.role)}`}>
                                  {getRoleLabel(member.role)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Joined {new Date(member.joined_at).toLocaleDateString(getUserLocale())}
                              </div>
                            </div>
                          </div>

                          {(canManageThisMember || canTransferToThisMember) && (
                            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                              {canTransferToThisMember && (
                                <button
                                  onClick={() => handleTransferOwnership(member.id, member.email || 'this user')}
                                  className="flex items-center gap-1 text-xs px-2 sm:px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors font-medium border border-yellow-300 dark:border-yellow-700 whitespace-nowrap"
                                  title="Transfer ownership to this member"
                                >
                                  <Crown className="h-3 w-3 flex-shrink-0" />
                                  <span className="hidden sm:inline">Make owner</span>
                                  <span className="sm:hidden">Owner</span>
                                </button>
                              )}
                              {canManageThisMember && (
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                                  title="Remove participant"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Custom (unlinked) tags */}
                    {familyMembers.filter(fm => !fm.household_member_id).map((fm) => (
                      <div
                        key={fm.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-s-4"
                        style={{ borderLeftColor: fm.color }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: fm.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {fm.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                                Custom tag
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              For transaction labeling only
                            </div>
                          </div>
                        </div>

                        {userRole === 'owner' && (
                          <button
                            onClick={() => handleEditTag(fm)}
                            className="p-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="Edit tag"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Member button */}
                  {userRole === 'owner' && (
                    <button
                      onClick={() => handleAddCustomTag()}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-2 mb-4"
                    >
                      <Plus className="h-4 w-4" />
                      Add member
                    </button>
                  )}
                </div>

                {/* Invite Section */}
                {canManageMembers && invitationCode && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-4">
                      <UserPlus className="h-5 w-5 me-2" />
                      Invite budget participants
                    </h3>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                        Share this code to invite others as budget participants:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={invitationCode}
                          readOnly
                          className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-700 rounded-md text-gray-900 dark:text-gray-100 font-mono text-sm select-all"
                        />
                        <button
                          onClick={handleCopyInvitationCode}
                          className={`px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors ${
                            copiedCode
                              ? 'bg-green-600 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {copiedCode ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Anyone with this code can join your household as a budget participant. They'll automatically get a household member tag for transactions.
                      </p>
                    </div>
                  </div>
                )}

                {/* Leaving the Household Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Leaving the household?
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <UserCheck className="h-4 w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">Switch households</span>
                    </button>
                    
                    <button
                      onClick={() => setShowLeaveModal(true)}
                      className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0 rtl:-scale-x-100" />
                      <span className="whitespace-nowrap">New household</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <JoinHouseholdModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
      <LeaveHouseholdModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
      />
      
      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2 sm:p-4" onClick={() => setEditingTag(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Edit household member tag
            </h3>
            
            <div className="space-y-4">
              {/* Tag Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tag name
                </label>
                <input
                  type="text"
                  value={editedTagName}
                  onChange={(e) => setEditedTagName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Enter tag name"
                />
              </div>

              {/* Tag Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={editedTagColor}
                    onChange={(e) => setEditedTagColor(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editedTagColor}
                    onChange={(e) => setEditedTagColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Link to Participant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to budget participant (optional)
                </label>
                <select
                  value={editedTagLinkedMember}
                  onChange={(e) => setEditedTagLinkedMember(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Unlinked (custom tag)</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.email || member.user_id}
                      {member.role === 'owner' && ' (Owner)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {editedTagLinkedMember 
                    ? 'This tag is linked to a participant and will be updated when they change' 
                    : 'This is a custom tag that can be used independently'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
                <button
                  onClick={handleSaveTagEdit}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium text-sm"
                >
                  Save changes
                </button>
                <button
                  onClick={handleDeleteTagFromModal}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                  title="Delete this tag"
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setEditingTag(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
};

export default HouseholdSettingsModal;
