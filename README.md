# 🟦 Spendify — Smart Spending. Clear Insights.

Spendify is a comprehensive, full-stack personal finance and expense tracking application designed to help you take control of your financial life. With a sleek, modern UI and powerful backend analytics, Spendify makes it easy to track daily expenses, manage multiple cards, and gain valuable insights into your spending habits.

![Spendify Banner](https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80)

---

## 🚀 Live Demo
[Check out Spendify Live](https://spendify-demo.example.com) *(Placeholder)*

---

## ✨ Features

### 📊 Financial Dashboard
- **Real-time Overview**: Instantly view your total balance, monthly income, and monthly expenses.
- **Dynamic Stats**: Visual progress bars and data cards reflecting your current financial status.

### 💸 Transaction Management
- **Add & Track**: Easily record income and expenses with detailed descriptions and dates.
- **Smart Categorization**: Group your spending into categories like *Food, Travel, Shopping, Salary, etc.*
- **Advanced Filters**: Search through history by date, category, type, or specific keywords.

### 💳 Card Management
- **Digital Wallet**: Manage multiple virtual cards within the app.
- **Balance Tracking**: Each card maintains its own balance and transaction history.

### 📈 Data Visualization
- **Insightful Charts**: Interactive "Income vs Expense" pie charts to visualize your cash flow.
- **Spending Analytics**: Deeper dives into where your money goes every month.

### 🔄 Advanced Functionality
- **Peer-to-Peer Transfers**: Send money between users within the Spendify ecosystem.
- **Recurring Transactions**: Automate periodic payments or subscription tracking.
- **Data Portability**: Export your entire transaction history to **CSV** for external accounting.

### 🔒 Security & Performance
- **Secure Auth**: JWT-based authentication with Refresh/Access token rotation.
- **Social Login**: Integrated "Continue with Google" OAuth 2.0 support.
- **Robust Protection**: CSRF protection, XSS sanitization, and NoSQL injection guards.
- **PWA Ready**: Offline support and service workers for a native app feel.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & Vanilla CSS3**: Custom-built design system with a premium "Glassmorphism" aesthetic.
- **JavaScript (ES6+)**: Reactive UI updates without the overhead of heavy frameworks.
- **Chart.js / Custom SVGs**: High-performance data visualization.

### Backend
- **Node.js & Express**: Scalable, asynchronous server architecture.
- **MongoDB & Mongoose**: Flexible document-based data modeling.
- **Passport.js**: Robust authentication middleware for Email/Password and Google OAuth.
- **Winston & Morgan**: Professional logging and request monitoring.

### Deployment & DevOps
- **Sentry**: Real-time error tracking and performance monitoring.
- **GitHub Actions**: (Optional) CI/CD for automated testing and deployment.
- **Vercel / Netlify**: Recommended for frontend hosting.
- **Render / Heroku**: Recommended for backend hosting.

---

## 📂 Project Structure

```text
spendify/
├── client/              # Frontend assets
│   ├── css/             # Custom design system & component styles
│   ├── js/              # Application logic (Auth, Dashboard, Utils)
│   ├── index.html       # Landing & Auth Page
│   └── dashboard.html   # Core user experience
├── server/              # Backend source code
│   ├── controllers/     # Business logic handlers
│   ├── models/          # Mongoose schemas (User, Transaction, Card)
│   ├── routes/          # Express API endpoints
│   ├── middleware/      # Auth, CSRF, Sanatization, Rate Limiting
│   └── server.js        # Main entry point
├── logs/                # System & Error logs
└── package.json         # Dependencies and scripts
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Manojs018/Spendify.git
cd spendify
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory or run the auto-setup script:
```bash
node server/scripts/setupEnv.js
```
Make sure to fill in your `MONGODB_URI` and Google OAuth credentials.

### 4. Run the Application
**Development Mode:**
```bash
npm run dev
```
**Start Full Stack (with frontend server):**
```bash
npm run dev:full
```

The app should now be running at `http://localhost:5000` (or `http://localhost:3000` if using the dev-client server).

---

## 📖 Usage
1. **Register**: Create an account via email or use Google Login.
2. **Setup Cards**: Go to the "Cards" tab and add your virtual cards with an initial balance.
3. **Log Transactions**: Use the "Quick Actions" on the dashboard to record your first income or expense.
4. **Analyze**: Head to the "Analytics" section to see your spending breakdown.
5. **Transfer**: Use "Send Money" to transfer funds to another Spendify user by their email.

---

## 📸 Screenshots
*(Add your screenshots here)*
| Dashboard | Transactions | Analytics |
| :---: | :---: | :---: |
| ![Dashboard Placeholder](https://via.placeholder.com/300x200?text=Dashboard+UI) | ![Transaction Placeholder](https://via.placeholder.com/300x200?text=Transactions+UI) | ![Analytics Placeholder](https://via.placeholder.com/300x200?text=Analytics+UI) |

---

## 🚀 Future Improvements
- [ ] **Budget Planning**: Set monthly limits for specific categories and get notifications.
- [ ] **Mobile App**: Develop a Flutter or React Native version for mobile users.
- [ ] **Dark Mode Toggle**: Native support for switching between light and dark themes.
- [ ] **AI Insights**: Use machine learning to predict next month's spending based on history.
- [ ] **PDF Reports**: Generatere professional monthly financial summaries in PDF format.

---

## 👨‍💻 Author
**Manoj S**
- GitHub: [@Manojs018](https://github.com/Manojs018)
- LinkedIn: [Your Profile](https://linkedin.com/in/yourprofile)

---

## 📄 License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---
*Developed with ❤️ by Manoj S*
