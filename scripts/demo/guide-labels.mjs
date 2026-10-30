// What capture-guide.mjs clicks and types, per language. Labels are looked up by key in
// src/i18n/locales, so the same capture script works in English and Hebrew;
// tests/scripts/guideLabels.test.ts checks every key exists in both languages.
import { readFileSync } from 'node:fs';

/** The UI labels the capture script finds by text, by translation key. */
export const LABEL_KEYS = {
  addTransaction: 'nav.addTransaction',
  manageHousehold: 'dashboard.manageHousehold',
  owner: 'household.owner',
  householdSettings: 'household.title',
  edit: 'common.edit',
  addMember: 'household.addMember',
  copy: 'household.copy',
  switchHouseholds: 'household.switch',
  budgetTab: 'tabs.budget',
  transactionsTab: 'tabs.transactions',
  insightsTab: 'tabs.insights',
  createBudget: 'budget.editor.create',
  budgetNamePlaceholder: 'budget.editor.namePlaceholder',
  groceries: 'budget.editor.defaults.groceries',
  saveCategory: 'transactions.edit.saveChanges',
  clickToCreate: 'budget.editor.clickToCreate',
  categoryNamePlaceholder: 'budget.editor.categoryNamePlaceholder',
  saveBudget: 'budget.editor.save',
  remaining: 'budget.overview.remaining',
  choose: 'transactions.form.choose',
  selectExpenseCategory: 'transactions.categoryPicker.titleExpense',
  descriptionPlaceholder: 'transactions.form.descriptionPlaceholder',
  incomeToggle: 'transactions.form.incomeToggle',
  expenseToggle: 'transactions.form.expenseToggle',
  installments: 'transactions.form.installments',
  monthsPlaceholder: 'transactions.form.monthsPlaceholder',
  settingsTab: 'budget.tabs.settings',
  categoriesTab: 'budget.tabs.categories',
  connectedAccounts: 'import.accounts.title',
  addAccount: 'transactions.form.addAccount',
  discountBank: 'import.providerNames.discount',
  visaCal: 'import.providerNames.visaCalFast',
  editTransaction: 'transactions.list.edit',
  detailsTab: 'categories.edit.tabs.edit',
  monthlyLimit: 'categories.edit.monthlyLimit',
  adjustTab: 'categories.edit.tabs.adjustment',
  newLimit: 'categories.edit.newLimit',
  mergeTab: 'categories.edit.tabs.merge',
  budgetHistory: 'history.title',
  budgetHistorySubtitle: 'history.subtitle',
  currentMonth: 'insights.ranges.mtd',
  budgetSummary: 'insights.summaryTitle',
  performanceTitle: 'insights.performanceTitle',
  accuracyTitle: 'insights.accuracyTitle',
  paceTitle: 'insights.pace.title',
  membersTitle: 'insights.membersTitle',
};

/** What the capture types into the demo household, per language. */
export const DATA = {
  en: {
    firstName: 'Dana',
    lastName: 'Levi',
    householdName: 'The Levi family',
    budgetName: 'Family budget',
    newCategories: [['Kids', 1200], ['Dining out', 900]],
    description: 'Shufersal weekly shop',
  },
  he: {
    firstName: 'דנה',
    lastName: 'לוי',
    householdName: 'משפחת לוי',
    budgetName: 'תקציב המשפחה',
    newCategories: [['ילדים', 1200], ['מסעדות', 900]],
    description: 'קנייה שבועית בשופרסל',
  },
};

/** The labels in `lang`, read from the app's own translation files (run from the repo root, like the capture). */
export function labels(lang) {
  const locale = JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, 'utf8'));
  return Object.fromEntries(
    Object.entries(LABEL_KEYS).map(([name, key]) => {
      const value = key.split('.').reduce((o, k) => o?.[k], locale);
      if (typeof value !== 'string') throw new Error(`No ${lang} text for ${key}`);
      return [name, value];
    }),
  );
}
