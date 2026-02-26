# 🟦 Spendify

**Smart Spending. Clear Insights.**

A modern, production-ready full-stack personal finance dashboard built with Node.js, Express, MongoDB, and Vanilla JavaScript.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Deployment](#-deployment)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- ✅ **Secure Authentication** - JWT-based auth with bcrypt password hashing
- ✅ **Transaction Management** - Full CRUD operations for income and expenses
- ✅ **Multi-Card Support** - Manage multiple cards and accounts
- ✅ **Card-to-Card Transfers** - Transfer money between your cards
- ✅ **User-to-User Transfers** - Send money to other registered users
- ✅ **Advanced Analytics** - Monthly summaries, category breakdowns, spending trends
- ✅ **Smart Filtering** - Filter transactions by type, category, date, and search
- ✅ **Real-time Balance** - Automatic balance updates with every transaction

### UI/UX
- 🎨 **Premium FinTech Design** - Dark theme with glassmorphism effects
- 🌈 **Neon Accents** - Vibrant blue gradients and glowing effects
- ✨ **Smooth Animations** - Micro-interactions and transitions
- 📱 **Fully Responsive** - Works seamlessly on desktop, tablet, and mobile
- 🎯 **Intuitive Interface** - Clean, modern, and easy to navigate

### Technical
- 🔒 **Production-Ready Security** - Rate limiting, helmet.js, input validation
- 🚀 **Optimized Performance** - Database indexing, efficient queries
- 📊 **RESTful API** - Clean, well-documented API architecture
- 🔄 **Error Handling** - Comprehensive error handling and logging
- 📝 **Input Validation** - Server-side and client-side validation

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcryptjs
- **Security:** Helmet, CORS, Express Rate Limit
- **Validation:** Express Validator
- **Logging:** Morgan

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Advanced styling with Grid, Flexbox, Glassmorphism
- **JavaScript (ES6+)** - Modern vanilla JavaScript
- **Font:** Inter (Google Fonts)

### Development Tools
- **Nodemon** - Auto-restart server on changes
- **Concurrently** - Run multiple commands simultaneously
- **dotenv** - Environment variable management

---

## 📁 Project Structure

```
Spendify/
│
├── client/                    # Frontend
│   ├── css/
│   │   ├── variables.css     # CSS custom properties
│   │   ├── global.css        # Global styles
│   │   ├── auth.css          # Authentication page styles
│   │   └── dashboard.css     # Dashboard styles (to be created)
│   ├── js/
│   │   ├── config.js         # API configuration
│   │   ├── utils.js          # Utility functions
│   │   ├── auth.js           # Authentication logic
│   │   └── dashboard.js      # Dashboard logic (to be created)
│   ├── index.html            # Login/Register page
│   └── dashboard.html        # Main dashboard (to be created)
│
├── server/                    # Backend
│   ├── config/
│   │   └── db.js             # Database connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── transactionController.js
│   │   ├── cardController.js
│   │   ├── analyticsController.js
│   │   └── transferController.js
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication middleware
│   │   └── errorHandler.js   # Error handling middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Transaction.js
│   │   └── Card.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── transactionRoutes.js
│   │   ├── cardRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── transferRoutes.js
│   └── server.js             # Main server file
│
├── .env                       # Environment variables
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or **yarn**

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spendify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your settings:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/spendify
   JWT_SECRET=your_super_secret_jwt_key
   JWT_EXPIRE=7d
   CLIENT_URL=http://localhost:3000
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/spendify` |
| `JWT_SECRET` | Secret key for JWT tokens | - |
| `JWT_EXPIRE` | JWT token expiration time | `7d` |
| `CLIENT_URL` | Frontend URL (for CORS) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

---

## 🏃 Running the Application

### Development Mode

**Option 1: Run backend and frontend separately**

Terminal 1 - Backend:
```bash
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run client
```

**Option 2: Run both concurrently**
```bash
npm run dev:full
```

### Production Mode

```bash
npm start
```

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/health

---

## 📚 API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token_hex_string"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

{
  "refreshToken": "your_refresh_token_hex_string"
}
```

### Transactions

#### Get All Transactions
```http
GET /api/transactions?type=expense&category=Food&month=12&year=2026&page=1&limit=10
Authorization: Bearer <token>
```

#### Create Transaction
```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00,
  "type": "expense",
  "category": "Food & Dining",
  "description": "Lunch at restaurant",
  "date": "2026-02-12"
}
```

#### Update Transaction
```http
PUT /api/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 55.00,
  "description": "Updated description"
}
```

#### Delete Transaction
```http
DELETE /api/transactions/:id
Authorization: Bearer <token>
```

### Cards

#### Get All Cards
```http
GET /api/cards
Authorization: Bearer <token>
```

#### Add Card
```http
POST /api/cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardNumber": "4532123456789012",
  "cardHolderName": "JOHN DOE",
  "expiry": "12/26",
  "cvv": "123",
  "balance": 1000.00
}
```

#### Transfer Between Cards
```http
POST /api/cards/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromCardId": "card_id_1",
  "toCardId": "card_id_2",
  "amount": 100.00
}
```

### Analytics

#### Get Dashboard Summary
```http
GET /api/analytics/summary
Authorization: Bearer <token>
```

#### Get Monthly Analytics
```http
GET /api/analytics/monthly?year=2026&month=2
Authorization: Bearer <token>
```

#### Get Category Breakdown
```http
GET /api/analytics/category?year=2026&month=2&type=expense
Authorization: Bearer <token>
```

#### Get Spending Trends
```http
GET /api/analytics/trends?year=2026&months=6
Authorization: Bearer <token>
```

### Transfers

#### Send Money to User
```http
POST /api/transfer/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipientEmail": "recipient@example.com",
  "amount": 50.00,
  "description": "Payment for dinner"
}
```

#### Get Transfer History
```http
GET /api/transfer/history?page=1&limit=10
Authorization: Bearer <token>
```

#### Search Users
```http
GET /api/transfer/search?email=john
Authorization: Bearer <token>
```

---

## 🔒 Security

### Implemented Security Measures

1. **Authentication & Authorization**
   - JWT-based authentication
   - Bcrypt password hashing (10 salt rounds)
   - Protected routes with middleware

2. **Input Validation**
   - Server-side validation with express-validator
   - Client-side validation
   - Mongoose schema validation

3. **Security Headers**
   - Helmet.js for security headers
   - CORS configuration
   - XSS protection

4. **Rate Limiting**
   - Express rate limit middleware
   - Configurable limits per IP

5. **Data Protection**
   - Passwords never returned in responses
   - CVV never returned in API responses
   - Sensitive data excluded from JSON serialization

6. **Error Handling**
   - Centralized error handling
   - No sensitive data in error messages
   - Proper HTTP status codes

---

## 🚀 Deployment

### Backend Deployment (Render/Railway/Cyclic)

1. Create account on deployment platform
2. Connect GitHub repository
3. Set environment variables
4. Deploy

### Frontend Deployment (Vercel/Netlify)

1. Create account on deployment platform
2. Connect GitHub repository
3. Set build command: `none` (static site)
4. Set publish directory: `client`
5. Deploy

### Database Deployment (MongoDB Atlas)

1. Create MongoDB Atlas account
2. Create cluster
3. Get connection string
4. Update `MONGODB_URI` in environment variables

---

## 📸 Screenshots

_Screenshots will be added after UI completion_

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Built with ❤️ for modern personal finance management

---

## 🙏 Acknowledgments

- Inter font by Google Fonts
- Icons and emojis for visual enhancement
- Inspiration from modern FinTech applications

---

**🟦 Spendify** - Smart Spending. Clear Insights.
