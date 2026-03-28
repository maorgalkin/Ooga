import type { BudgetTemplate } from '../types/budget';

export const budgetTemplate: BudgetTemplate = {
  version: "1.0",
  currency: "ILS",
  created: "2025-08-24",
  description: "Ooga Family Budget Template - Configurable monthly budget limits for expense tracking and financial planning",
  
  monthlyBudgets: {
    totalMonthlyLimit: 15000,
    categories: {
      "Food & Dining": {
        monthlyLimit: 2500,
        priority: "high",
        alertThreshold: 80,
        description: "Restaurants, cafes, and dining out",
        subcategories: ["Restaurants", "Fast Food", "Coffee Shops", "Special Occasions"]
      },
      "Groceries": {
        monthlyLimit: 2000,
        priority: "high", 
        alertThreshold: 85,
        description: "Supermarket, fresh produce, household essentials",
        subcategories: ["Supermarket", "Organic", "Bulk Shopping", "Household Items"]
      },
      "Bills & Utilities": {
        monthlyLimit: 1500,
        priority: "critical",
        alertThreshold: 90,
        description: "Electricity, water, internet, phone, insurance",
        subcategories: ["Electricity", "Water", "Internet", "Mobile", "Insurance", "Municipal Tax"]
      },
      "Transportation": {
        monthlyLimit: 1200,
        priority: "medium",
        alertThreshold: 75,
        description: "Fuel, public transport, car maintenance, parking",
        subcategories: ["Fuel", "Public Transport", "Car Maintenance", "Parking", "Car Insurance"]
      },
      "Shopping": {
        monthlyLimit: 1000,
        priority: "medium",
        alertThreshold: 70,
        description: "Clothing, electronics, household goods",
        subcategories: ["Clothing", "Electronics", "Household", "Personal Items"]
      },
      "Healthcare": {
        monthlyLimit: 800,
        priority: "high",
        alertThreshold: 85,
        description: "Medical expenses, medications, dental, vision",
        subcategories: ["Doctor Visits", "Medications", "Dental", "Vision", "Medical Tests"]
      },
      "Entertainment": {
        monthlyLimit: 600,
        priority: "low",
        alertThreshold: 60,
        description: "Movies, concerts, hobbies, subscriptions",
        subcategories: ["Movies", "Concerts", "Hobbies", "Streaming", "Games", "Books"]
      },
      "Education": {
        monthlyLimit: 500,
        priority: "high",
        alertThreshold: 80,
        description: "Courses, books, school expenses, tutoring",
        subcategories: ["School Fees", "Books", "Courses", "Tutoring", "Educational Materials"]
      },
      "Travel": {
        monthlyLimit: 400,
        priority: "low",
        alertThreshold: 70,
        description: "Vacation, weekend trips, travel expenses",
        subcategories: ["Flights", "Hotels", "Local Transport", "Activities", "Food & Dining"]
      },
      "Home & Garden": {
        monthlyLimit: 300,
        priority: "medium",
        alertThreshold: 75,
        description: "Home improvement, garden supplies, maintenance",
        subcategories: ["Maintenance", "Garden", "Furniture", "Decorations", "Tools"]
      },
      "Other": {
        monthlyLimit: 200,
        priority: "low",
        alertThreshold: 50,
        description: "Miscellaneous expenses not covered by other categories",
        subcategories: ["Gifts", "Donations", "Fees", "Unexpected"]
      }
    }
  },

  familyMemberBudgets: {
    enabled: true,
    individual: {
      "Maor": {
        monthlyAllowance: 1000,
        categories: ["Entertainment", "Shopping", "Food & Dining"],
        alertThreshold: 80
      },
      "Michal": {
        monthlyAllowance: 1000,
        categories: ["Entertainment", "Shopping", "Food & Dining"],
        alertThreshold: 80
      },
      "Alma": {
        monthlyAllowance: 200,
        categories: ["Entertainment", "Education"],
        alertThreshold: 70
      },
      "Luna": {
        monthlyAllowance: 100,
        categories: ["Entertainment"],
        alertThreshold: 70
      }
    }
  },

  incomeTargets: {
    monthlyTarget: 18000,
    categories: {
      "Salary": {
        monthlyTarget: 15000,
        priority: "critical",
        description: "Primary salary income"
      },
      "Rent": {
        monthlyTarget: 0,
        priority: "medium",
        description: "Rental property income"
      },
      "Government Allowance": {
        monthlyTarget: 2000,
        priority: "medium",
        description: "Child allowance, benefits"
      },
      "Gift": {
        monthlyTarget: 0,
        priority: "low",
        description: "Occasional gifts from family"
      },
      "Other": {
        monthlyTarget: 1000,
        priority: "low",
        description: "Miscellaneous income sources"
      }
    }
  },

  alerts: {
    enabled: true,
    types: {
      "budgetExceeded": {
        enabled: true,
        severity: "high",
        message: "Budget limit exceeded for category: {category}"
      },
      "approachingLimit": {
        enabled: true,
        severity: "medium",
        message: "Approaching budget limit for {category}: {percentage}% used"
      },
      "incomeShortfall": {
        enabled: true,
        severity: "high",
        message: "Monthly income target not met: {shortfall} below target"
      },
      "unusualSpending": {
        enabled: true,
        severity: "medium",
        message: "Unusual spending pattern detected in {category}"
      }
    }
  },

  savingsGoals: {
    enabled: true,
    emergency: {
      target: 50000,
      priority: "critical",
      description: "Emergency fund (3 months expenses)",
      monthlyTarget: 2000
    },
    vacation: {
      target: 15000,
      priority: "medium",
      description: "Annual family vacation",
      monthlyTarget: 1250
    },
    homeImprovement: {
      target: 30000,
      priority: "low",
      description: "Home renovation project",
      monthlyTarget: 1000
    }
  },

  reporting: {
    comparisonPeriods: ["month", "quarter", "year"],
    metrics: {
      budgetVariance: true,
      categoryTrends: true,
      savingsRate: true,
      incomeExpenseRatio: true,
      familyMemberSpending: true
    },
    exportFormats: ["json", "csv", "pdf"]
  },

  settings: {
    autoAdjustBudgets: false,
    inflationAdjustment: 0.03,
    reviewPeriod: "monthly",
    rolloverUnusedBudget: true,
    strictMode: false
  }
};
