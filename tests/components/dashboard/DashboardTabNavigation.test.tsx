import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardTabNavigation } from '../../../src/components/dashboard/DashboardTabNavigation';

describe('DashboardTabNavigation', () => {
  it('names the alert count in the Dashboard tab without covering its label', () => {
    render(<DashboardTabNavigation activeTab="dashboard" onTabChange={vi.fn()} alertsCount={4} />);
    expect(screen.getByRole('button', { name: 'Dashboard 4 new budget alerts' })).toBeInTheDocument();
  });

  it('shows just the label without alerts', () => {
    render(<DashboardTabNavigation activeTab="dashboard" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
