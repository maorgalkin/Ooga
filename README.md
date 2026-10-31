# Ooga - Family Finance Tracker

A modern, intuitive family finance tracking application built with React and TypeScript. Track expenses, manage budgets, and gain insights into your family's financial health.

## 📚 Documentation

For comprehensive documentation, please refer to:

- **[Complete Feature Summary](docs/COMPLETE_FEATURE_SUMMARY.md)** - Detailed overview of all Ooga features, technology stack, and capabilities
- **[Supabase Setup Guide](docs/SUPABASE_BRINGUP.md)** - Step-by-step guide for setting up the Supabase backend
- **[Test Documentation](docs/TEST_DOCUMENTATION.md)** - Complete testing guide, test suites, and best practices
- **[Bank Import](docs/BANK_IMPORT.md)** - How Cal and Discount imports work, and the scraper service
- **[Scraper Deployment](docs/SCRAPER_DEPLOY.md)** - The Vultr server behind `api.haooga.com`
- **[Cloudflare Setup](docs/CLOUDFLARE_SETUP.md)** - Hosting for the web app (auto-deploys from `master`)
- **[Guide Screenshots](docs/GUIDE_SCREENSHOTS.md)** - Refreshing the screenshots in the Getting started guide

## 🌟 Features

- **Transaction Management**: Add, view, and categorize income and expenses
- **Family-Friendly**: Track transactions by family member with color-coded attribution
- **Visual Dashboard**: Interactive charts and financial summaries
- **Advanced Budget System**: Comprehensive budget planning with spending limits and alerts
- **Budget Alerts**: Categories near or over their limit are flagged on the Dashboard; the tab's badge counts the ones you haven't opened yet
- **Cloud Storage**: Secure Supabase backend with authentication
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Sync**: Cross-device synchronization via Supabase

## 🚀 Getting Started

### Prerequisites

- Node.js 22 (what CI and the scraper image use; Vite 7 needs at least 20.19)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/maorgalkin/Ooga.git
   cd Ooga
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     VITE_SITE_URL=http://localhost:5173  # production: https://haooga.com, set in Cloudflare's build settings
     ```
   - See [Supabase Setup Guide](docs/SUPABASE_BRINGUP.md) for detailed instructions

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

Create a production build (type-checks first, like Cloudflare's build):
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

### Running Tests

Run the checks CI runs on every pull request:
```bash
npm run typecheck         # tsc -b
npm run test:run          # unit tests, once (never touch a real Supabase project)
npm run lint              # ESLint (CI only fails if the error count goes up)
```

Other test commands:
```bash
npm test                  # unit tests in watch mode
npm run test:ui           # interactive UI
npm run test:integration  # integration suites against a test Supabase project (.env.test.local)
```

For detailed testing information, see [Test Documentation](docs/TEST_DOCUMENTATION.md).

## 💡 How to Use

### Adding Transactions

1. Click the "Add Transaction" button in the top navigation
2. Fill in the transaction details:
   - Description (required)
   - Amount (required)
   - Type (Income or Expense)
   - Category (required)
   - Family Member (optional)
   - Date
3. Click "Add Transaction" to save

### Dashboard Overview

The dashboard provides two main views:

#### Budget Analysis Tab
- **Summary Cards**: Total income, expenses, balance, family member count, and budget status
- **Month Navigation**: Switch between current and previous months
- **Transaction Filtering**: Filter by income/expense types or hover summary cards
- **Expense Categories Chart**: Visual breakdown of spending by category
- **Budget vs Actual Chart**: Compare budgeted amounts with actual spending

#### Transactions Tab
- **Transaction History**: Detailed view of all transactions
- **Filter Controls**: Advanced filtering by date, category, member, and amount
- **Quick Actions**: Add, edit, or delete transactions
- **Search**: Find transactions by description, category, or family member

### Budget Management

Access budget settings through the Budget Settings modal:

#### Visual Tab
- **Global Settings**: Currency, warning notifications, email alerts
- **Category Management**: Set monthly limits and warning thresholds
- **Active/Inactive Categories**: Toggle categories on/off
- **Family Members**: View and manage family members with color codes
- **Category Colors**: Customize category appearance

#### JSON Tab
- **Direct Editing**: Edit budget configuration as JSON
- **Import/Export**: Share or backup budget templates
- **Validation**: Real-time JSON syntax validation

For detailed budget configuration, see [Complete Feature Summary](docs/COMPLETE_FEATURE_SUMMARY.md).

### Data Storage & Security

**Supabase Backend:**
- **Authentication**: Secure email/password authentication with email verification
- **Cloud Storage**: All data stored in PostgreSQL database
- **Row Level Security (RLS)**: User data automatically isolated
- **Real-time Sync**: Changes sync across devices in real-time
- **Backup**: Automatic cloud backups

For setup instructions, see [Supabase Setup Guide](docs/SUPABASE_BRINGUP.md).

## 🛠 Technology Stack

- **Frontend Framework**: React 19.1.1 with TypeScript 5.8.3
- **Build Tool**: Vite 7.1.2
- **Styling**: Tailwind CSS 3.4 (JS config; don't upgrade to v4)
- **Charts**: Recharts 3.1.2
- **Icons**: Lucide React 0.539.0
- **Animation**: Framer Motion 12.23.24
- **Backend**: Supabase 2.75.0 (PostgreSQL + Auth)
- **Testing**: Vitest 3.2.4 + React Testing Library 16.3.0
- **Routing**: React Router DOM 6.30.1
- **Hosting**: Cloudflare (web app), Vultr in Tel Aviv (bank scraper at `api.haooga.com`), Supabase (database and auth)
- **CI**: GitHub Actions (`.github/workflows/`)

For complete technology details, see [Complete Feature Summary](docs/COMPLETE_FEATURE_SUMMARY.md).

## 🎯 Future Enhancements

- [ ] Recurring transactions
- [ ] Bill reminders with notifications
- [ ] Receipt photo attachments
- [ ] Advanced reporting and PDF export
- [ ] Savings goals with progress tracking
- [ ] CSV import/export
- [ ] Mobile app (React Native for iOS/Android)
- [ ] AI-powered spending insights
- [ ] Budget templates library

## 🧪 Testing

Ooga has ~280 unit tests (Vitest + React Testing Library) under `tests/`, plus integration suites in `tests/integration/` that run against a real Supabase test project. CI runs the type-check, unit tests, lint ratchet, build and the scraper checks on every pull request.

See [Test Documentation](docs/TEST_DOCUMENTATION.md) for complete testing information.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open source and available under the MIT License.

---

**Happy budgeting! 💰**
