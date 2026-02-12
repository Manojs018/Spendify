# 🚀 Spendify - Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js installed (v14+)
- ✅ MongoDB installed OR MongoDB Atlas account
- ✅ A code editor (VS Code recommended)
- ✅ Terminal/Command Prompt access

---

## 🏃 Quick Start (5 Minutes)

### Step 1: Install Dependencies

**Windows Users:**
```cmd
Double-click install.bat
```

**OR manually:**
```cmd
npm install
```

### Step 2: Configure Environment

The `.env` file is already created with default values. If using MongoDB Atlas, update the connection string:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spendify
```

### Step 3: Start MongoDB (if local)

**Windows:**
```cmd
mongod
```

**Mac/Linux:**
```bash
sudo systemctl start mongod
```

### Step 4: Start the Backend

```cmd
npm run dev
```

You should see:
```
✅ MongoDB Connected
🟦 SPENDIFY API SERVER
🚀 Server running on port 5000
```

### Step 5: Test the API

Open browser and visit:
- http://localhost:5000 - Welcome message
- http://localhost:5000/health - Health check

---

## 📝 What's Working Now

### ✅ Backend (100% Complete)
- All API endpoints functional
- Database models ready
- Authentication system ready
- Transaction management ready
- Card management ready
- Analytics ready
- Transfer system ready

### ✅ Frontend (50% Complete)
- Login/Register page ready
- Authentication flow working
- Can create account and login
- Redirects to dashboard (needs to be created)

---

## 🧪 Testing the API

### 1. Register a User

```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}
```

### 2. Login

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Copy the `token` from response.

### 3. Create a Transaction

```bash
POST http://localhost:5000/api/transactions
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "amount": 100,
  "type": "income",
  "category": "Salary",
  "description": "Monthly salary",
  "date": "2026-02-12"
}
```

### 4. Get Analytics

```bash
GET http://localhost:5000/api/analytics/summary
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🎯 Next Development Steps

1. **Create Dashboard Page**
   - Build dashboard.html
   - Create dashboard.css
   - Implement dashboard.js

2. **Add Dashboard Features**
   - Display balance, income, expense
   - Show recent transactions
   - Display cards
   - Show analytics charts

3. **Test Complete Flow**
   - Register → Login → Dashboard
   - Add transactions
   - Add cards
   - Send money

4. **Deploy**
   - Backend to Render/Railway
   - Frontend to Vercel/Netlify
   - Database to MongoDB Atlas

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Start MongoDB service
```cmd
mongod
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change PORT in .env or kill the process using port 5000

### npm install fails
```
Error: running scripts is disabled
```
**Solution:** Run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📚 Useful Commands

```bash
# Install dependencies
npm install

# Start backend (development)
npm run dev

# Start backend (production)
npm start

# Start frontend
npm run client

# Start both (when dashboard is ready)
npm run dev:full
```

---

## 🔗 Important URLs

- **Backend API:** http://localhost:5000
- **Frontend:** http://localhost:3000 (when served)
- **API Health:** http://localhost:5000/health
- **MongoDB:** mongodb://localhost:27017

---

## 📖 API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Cards
- `GET /api/cards` - Get all cards
- `POST /api/cards` - Add card
- `POST /api/cards/transfer` - Transfer between cards

### Analytics
- `GET /api/analytics/summary` - Dashboard summary
- `GET /api/analytics/monthly` - Monthly analytics
- `GET /api/analytics/category` - Category breakdown
- `GET /api/analytics/trends` - Spending trends

### Transfers
- `POST /api/transfer/send` - Send money to user
- `GET /api/transfer/history` - Transfer history
- `GET /api/transfer/search` - Search users

---

## 💡 Tips

1. **Use Postman or Thunder Client** for API testing
2. **Keep MongoDB running** while developing
3. **Check server logs** for errors
4. **Use the toast notifications** for user feedback
5. **Test on different browsers** for compatibility

---

## 🎉 You're Ready!

The backend is fully functional. You can now:
1. Test all API endpoints
2. Create the dashboard UI
3. Connect frontend to backend
4. Deploy to production

---

**Need Help?** Check the main README.md for detailed documentation.

**🟦 Spendify** - Smart Spending. Clear Insights.
