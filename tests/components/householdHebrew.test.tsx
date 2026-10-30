import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { applyLanguage } from '../../src/i18n';
import HouseholdSettingsModal from '../../src/components/HouseholdSettingsModal';
import { JoinHouseholdModal } from '../../src/components/JoinHouseholdModal';
import { LeaveHouseholdModal } from '../../src/components/LeaveHouseholdModal';

const household = vi.hoisted(() => ({
  getUserHousehold: vi.fn(),
  getHouseholdMembers: vi.fn(),
  getUserRole: vi.fn(),
  generateInvitationCode: vi.fn(),
  isUserSoleOwner: vi.fn(),
  acceptInvitationAndJoin: vi.fn(),
}));
vi.mock('../../src/services/householdService', () => household);
vi.mock('../../src/services/supabaseDataService', () => ({
  getFamilyMembers: () => Promise.resolve([{ id: 'fm1', name: 'Noa', color: '#ef4444', household_member_id: null }]),
}));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { user_metadata: { first_name: 'Dana' } } } }) } },
}));

// Latin words left once the data (names, emails, the code) is set aside
const english = (data: string[]) =>
  (document.body.textContent?.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !data.includes(w));

beforeEach(() => {
  household.getUserHousehold.mockResolvedValue({ id: 'h1', name: 'The Levi family' });
  household.getHouseholdMembers.mockResolvedValue([
    { id: 'm1', user_id: 'test-user-123', role: 'owner', email: 'dana@example.com', joined_at: '2026-10-01' },
    { id: 'm2', user_id: 'u2', role: 'participant', email: 'avi@example.com', joined_at: '2026-10-02' },
  ]);
  household.getUserRole.mockResolvedValue('owner');
  household.generateInvitationCode.mockResolvedValue('aW52aXRl');
  household.isUserSoleOwner.mockResolvedValue(false);
  applyLanguage('he');
});
afterEach(() => applyLanguage('en'));

describe('household windows in Hebrew', () => {
  it('household settings use the labels the Hebrew guide quotes, with no English left', async () => {
    render(<HouseholdSettingsModal isOpen onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: 'עריכה' })).toBeInTheDocument();
    // Quoted in guide.he.json, chapter "household"
    expect(screen.getByRole('button', { name: /הוספת בן\/בת משפחה/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'הזמנת משתתפים' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /העתקה/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מעבר למשק בית אחר/ })).toBeInTheDocument();
    expect(english(['The', 'Levi', 'family', 'dana', 'avi', 'example', 'com', 'Noa', 'aW', 'NpdGU'])).toEqual([]);
  });

  it('switching households warns in Hebrew and offers the guide\'s "delete data & join"', async () => {
    household.acceptInvitationAndJoin.mockResolvedValue({ success: false, willDeleteData: true, householdName: 'Cohen' });
    render(<JoinHouseholdModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'הצטרפות למשק בית' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('הדבקת קוד ההזמנה כאן'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /הצטרפות למשק בית/ }));
    expect(await screen.findByRole('button', { name: /מחיקת הנתונים והצטרפות/ })).toBeInTheDocument();
    expect(english(['Cohen'])).toEqual([]);
  });

  it('leaving suggests a Hebrew name for the new household', async () => {
    render(<LeaveHouseholdModal isOpen onClose={() => {}} />);
    expect(await screen.findByDisplayValue('משק הבית החדש של Dana')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'עזיבה והקמת משק בית חדש' })).toBeInTheDocument();
    expect(english(['Dana', 'The', 'Levi', 'family'])).toEqual([]);
  });
});
