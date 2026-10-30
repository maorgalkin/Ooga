// Category icon/emoji mapping for expense categories
export const categoryIcons: Record<string, string> = {
  // Default expense categories
  "Food & Dining": "🍽️",
  "Groceries": "🛒",
  "Transportation": "🚗",
  "Shopping": "🛍️",
  "Entertainment": "🎬",
  "Bills & Utilities": "💡",
  "Loan Payments": "💳",
  "Healthcare": "⚕️",
  "Education": "📚",
  "Travel": "✈️",
  "Home & Garden": "🏠",
  "Housing": "🏡",
  "Digital Subscriptions": "📱",
  "Other": "📦",
  
  // Default expense categories when a budget is created in Hebrew (budget.editor.defaults)
  "מכולת": "🛒",
  "תחבורה": "🚗",
  "בילויים": "🎬",
  "חשבונות": "💡",
  "בית וגינה": "🏠",

  // Income categories
  "Salary": "💰",
  "Rent": "💵",
  "Government Allowance": "🏛️",
  "Gift": "🎁",
};

// Default icon for custom/user-created categories
export const CUSTOM_CATEGORY_ICON = "⭐";

// Get icon for a category, return custom icon if not found
export const getCategoryIcon = (category: string): string => {
  return categoryIcons[category] || CUSTOM_CATEGORY_ICON;
};

// Available colors for new categories
export const availableColors = [
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Green
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F43F5E", // Rose
  "#8B5A00", // Brown
  "#6B7280", // Gray
  "#DC2626", // Dark Red
  "#0891B2", // Dark Cyan
  "#7C3AED", // Dark Purple
  "#DB2777", // Dark Pink
];

// Get next available color that hasn't been used
export const getNextAvailableColor = (usedColors: string[]): string => {
  const unusedColor = availableColors.find(color => !usedColors.includes(color));
  // If all colors are used, return a random one
  return unusedColor || availableColors[Math.floor(Math.random() * availableColors.length)];
};

// Get category color from budget config
export const getCategoryColor = (category: string): string => {
  try {
    const config = JSON.parse(localStorage.getItem('budgetConfig') || '{}');
    return config.categories?.[category]?.color || '#64748B'; // Default gray if not found
  } catch {
    return '#64748B'; // Default gray on error
  }
};
