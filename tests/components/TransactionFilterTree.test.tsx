import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionFilterTree } from '../../src/components/transactions/TransactionFilterTree';
import type { CategoryGroup } from '../../src/utils/transactionFilters';

const groups: CategoryGroup[] = [
  { type: 'expense', label: 'Expenses', categories: ['Dining', 'Groceries'] },
  { type: 'income', label: 'Income', categories: ['Salary'] },
];

const renderTree = (categoryGroups: CategoryGroup[], onCategoryChange = vi.fn()) =>
  render(
    <TransactionFilterTree
      selectedTypes={[]}
      selectedMembers={[]}
      selectedCategories={[]}
      familyMembers={[]}
      categoryGroups={categoryGroups}
      onTypeChange={vi.fn()}
      onMemberChange={vi.fn()}
      onCategoryChange={onCategoryChange}
    />
  );

describe('TransactionFilterTree categories', () => {
  it('shows income categories under their own heading when both types are listed', () => {
    renderTree(groups);
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Income', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByLabelText('Salary')).toBeInTheDocument();
  });

  it('shows no group headings when only one type is listed', () => {
    renderTree([groups[1]]);
    expect(screen.queryByText('Expenses')).toBeNull();
    expect(screen.queryByText('Income', { selector: 'p' })).toBeNull();
    expect(screen.getByLabelText('Salary')).toBeInTheDocument();
  });

  it('"Select All" selects every listed category across groups', () => {
    const onCategoryChange = vi.fn();
    renderTree(groups, onCategoryChange);
    // Each section has its own "Select All"; the categories section is last
    const selectAlls = screen.getAllByLabelText('Select All', { selector: 'input' });
    fireEvent.click(selectAlls[selectAlls.length - 1]);
    expect(onCategoryChange).toHaveBeenCalledWith(['Dining', 'Groceries', 'Salary']);
  });
});
