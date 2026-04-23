# 🟦 Spendify — Smart Spending. Clear Insights.

Spendify is a premium, full-stack personal finance ecosystem designed for the modern user. Combining a high-performance **Express.js API** with a sleek **Vanilla JavaScript SPA**, Spendify offers real-time expense tracking, multi-card management, and deep financial analytics with a focus on privacy, security, and "Glassmorphism" aesthetics.

---

## 🚀 Live Demonstration
The application is optimized for cloud deployment.
[**Spendify on Vercel**](https://spendify.vercel.app) *(Update with your actual URL)*

---

## ✨ Features

### 💎 Premium User Experience
*   **State-of-the-Art UI**: A custom-crafted dashboard using modern design principles (Glassmorphism, Vibrant Gradients).
*   **Unified Dashboard**: Real-time balance updates, income/expense tracking, and interactive financial cards.
*   **PWA Ready**: Install Spendify on your desktop or mobile device for a native application feel.

### 📊 Deep Analytics
*   **Dynamic Visualizations**: Interactive charts powered by Chart.js for Income vs. Expenses and Category breakdown.
*   **Advanced Filtering**: Powerful search and filter engine for navigating years of financial history instantly.
*   **Data Portability**: Professional CSV export feature for deep-dive accounting in Excel or Google Sheets.

### 🛡️ Enterprise-Grade Security
*   **Hybrid Authentication**: Secure Email/Password registration + Social Login via Google OAuth 2.0.
*   **Advanced Session Management**: JWT-based auth with automatic access/refresh token rotation and fingerprinting.
*   **Robust Data Protection**: AES-256-CBC encryption for sensitive card data and salted password hashing with Bcrypt.
*   **Security Layers**: Integrated CSRF protection, XSS sanitization, and NoSQL injection guards.

### 💸 Financial Ecosystem
*   **Peer-to-Peer Transfers**: Instant internal money transfers between Spendify users via email identifiers.
*   **Card Management**: Virtual wallet supporting multiple cards with independent balances and histories.
*   **Automation**: Built-in recurring transaction engine to automate monthly subscriptions and bills.

---

## 🛠️ Technology Stack

### Frontend Architecture
*   **Core**: Semantic HTML5 & Modern Vanilla JavaScript (ES6+).
*   **Styling**: Custom CSS3 design system (No heavy frameworks for maximum performance).
*   **Data Viz**: High-performance SVG and Chart.js integration.

### Backend Architecture
*   **Runtime**: Node.js with the Express.js framework.
*   **Database**: MongoDB with Mongoose ODM (optimized for Atlas).
*   **Caching**: Multi-layer cache (Redis with a localized In-Memory fallback).
*   **Security**: Passport.js with JWT Strategy and CSRF middleware.

---

## ⚙️ Quick Start & Installation

### 1. Requirements
*   Node.js (v18+)
*   MongoDB Instance (Local or Atlas)
*   Redis (Optional, for caching)

### 2. Local Setup
```bash
# Clone the repository
git clone https://github.com/Manojs018/Spendify.git
cd Spendify

# Install dependencies
npm install

# Auto-generate secure environment variables
node server/scripts/setupEnv.js
```

### 3. Environment Variables
Ensure your `.env` (local) or Vercel Dashboard (cloud) has the following configured:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGODB_URI` | Connection string for MongoDB | `mongodb+srv://...` |
| `JWT_SECRET` | 256-bit secure random key | `your_64_char_hex` |
| `ENCRYPTION_KEY` | 32-byte key for card encryption | `your_64_char_hex` |
| `CLIENT_URL` | Frontend URL for CORS | `https://your-app.vercel.app` |

### 4. Running the App
```bash
# Local development with auto-reload
npm run dev

# Full stack mode (Server + Client)
npm run dev:full
```

---

## 📂 Project Governance

```text
Spendify/
├── api/                 # Serverless entry points for Vercel
├── client/              # Frontend Single Page Application
│   ├── css/             # Modular design system
│   ├── js/              # Application logic (Auth, State, Charts)
│   └── assets/          # Professional branding & iconography
├── server/              # Backend core architecture
│   ├── controllers/     # Modular business logic
│   ├── models/          # Data schemas (Encrypted & Indexed)
│   ├── middleware/      # Security & Validation layers
│   └── scripts/         # Automated maintenance & setup
├── vercel.json          # Deployment & Routing configuration
└── package.json         # Dependencies & Build scripts
```

---

---

## 🤝 Contributing
Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👨‍💻 Author
**Manoj S**
*   GitHub: [@Manojs018](https://github.com/Manojs018)
*   LinkedIn: [Manoj Sekar](https://linkedin.com/in/manojsekar)

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for more information.

---
*Developed with ❤️ by Manoj S*
