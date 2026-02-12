# 🚀 Quick Start - View on Localhost

## ⚡ Fastest Way to Preview (No Backend Needed)

### **Option 1: Direct File Access** (Easiest - Works Now!)
```
1. Open File Explorer
2. Navigate to: c:\Users\Manoj\spendiFy\client
3. Double-click: index.html
4. Browser opens with the login page ✅
```

**Note:** This works immediately but API calls won't work (no backend).

---

## 🔥 Full Experience on Localhost (With Backend)

### **Prerequisites:**
- Node.js installed ✅
- MongoDB installed (or MongoDB Atlas account)

---

## 📋 Step-by-Step Setup

### **Step 1: Fix PowerShell Execution Policy** (One-time)

Open **PowerShell as Administrator** and run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Press **Y** to confirm.

---

### **Step 2: Install Dependencies**

Open terminal in project folder:
```bash
cd c:\Users\Manoj\spendiFy
npm install
```

This installs all backend dependencies (~2 minutes).

---

### **Step 3: Start MongoDB**

**Option A - Local MongoDB:**
```bash
# Open a NEW terminal
mongod
```
Keep this terminal open.

**Option B - MongoDB Atlas:**
Update `.env` file with your Atlas connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spendify
```

---

### **Step 4: Start Backend Server**

Open a NEW terminal:
```bash
cd c:\Users\Manoj\spendiFy
npm run dev
```

You should see:
```
✅ MongoDB Connected
🟦 SPENDIFY API SERVER
🚀 Server running on port 5000
```

Backend is now running at: **http://localhost:5000**

---

### **Step 5: Start Frontend Server**

**Option A - Using Built-in Node Server (Recommended):**
```bash
# Open a NEW terminal
cd c:\Users\Manoj\spendiFy
node serve-frontend.js
```

Frontend is now running at: **http://localhost:3000**

**Option B - Using Python:**
```bash
cd c:\Users\Manoj\spendiFy\client
python -m http.server 3000
```

**Option C - Using VS Code Live Server:**
1. Install "Live Server" extension
2. Right-click `client/index.html`
3. Select "Open with Live Server"

---

## 🌐 Access the Application

Once both servers are running:

1. **Open Browser:** http://localhost:3000
2. **You'll see:** Beautiful login page with dark theme
3. **Click "Sign up"** to create an account
4. **Fill in:**
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
5. **Click "Create Account"**
6. **Automatically redirected to dashboard!**

---

## 🎯 What You'll See

### **Login Page (http://localhost:3000)**
- Premium dark theme
- Glassmorphism effects
- Smooth animations
- Login/Register toggle

### **Dashboard (After Login)**
- Real-time balance: $0.00 (initially)
- Monthly income/expense stats
- Quick action buttons
- Recent transactions (empty initially)
- Card carousel (empty initially)
- Category breakdown

---

## 🧪 Test the Features

### **1. Add Income Transaction**
```
Click "Add Income" button
Amount: 3000
Category: Salary
Description: Monthly salary
Date: Today
Click "Save Transaction"
```
✅ Balance updates to $3,000!

### **2. Add Expense Transaction**
```
Click "Add Expense" button
Amount: 150
Category: Food & Dining
Description: Groceries
Date: Today
Click "Save Transaction"
```
✅ Balance updates to $2,850!

### **3. Add a Card**
```
Click "Add Card" button
Card Number: 4532 1234 5678 9012
Holder Name: JOHN DOE
Expiry: 12/26
CVV: 123
Balance: 2500
Click "Add Card"
```
✅ Card appears in carousel!

### **4. View Analytics**
```
Click "Analytics" in sidebar
See 6-month spending trends
View category breakdown
```

### **5. Send Money**
```
Create another user account (different email)
Click "Send Money"
Enter recipient email
Enter amount
Click "Send Money"
```
✅ Money transferred!

---

## 🔍 Verify Everything is Working

### **Backend Health Check:**
Open: http://localhost:5000/health

Should show:
```json
{
  "status": "OK",
  "timestamp": "2026-02-12T..."
}
```

### **Frontend Access:**
Open: http://localhost:3000

Should show: Beautiful login page

### **API Test:**
Open: http://localhost:5000

Should show: Welcome message with API endpoints

---

## 🐛 Troubleshooting

### **Problem: npm install fails**
**Solution:**
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Problem: MongoDB connection error**
**Solution:**
```bash
# Make sure MongoDB is running
mongod

# Or use MongoDB Atlas and update .env
```

### **Problem: Port 5000 already in use**
**Solution:**
```
# Edit .env file
PORT=5001

# Or kill the process using port 5000
```

### **Problem: Port 3000 already in use**
**Solution:**
```bash
# Use a different port
node serve-frontend.js
# Edit the PORT variable in serve-frontend.js to 3001
```

### **Problem: CORS errors**
**Solution:**
The backend is already configured for CORS.
Make sure CLIENT_URL in .env matches your frontend URL.

---

## 📊 Terminal Layout

You'll need **3 terminals open**:

```
Terminal 1: MongoDB
┌─────────────────────────┐
│ > mongod                │
│ [MongoDB running...]    │
└─────────────────────────┘

Terminal 2: Backend
┌─────────────────────────┐
│ > npm run dev           │
│ Server on port 5000     │
└─────────────────────────┘

Terminal 3: Frontend
┌─────────────────────────┐
│ > node serve-frontend.js│
│ Server on port 3000     │
└─────────────────────────┘
```

---

## 🎉 Success Checklist

- [ ] PowerShell execution policy fixed
- [ ] Dependencies installed (`npm install`)
- [ ] MongoDB running
- [ ] Backend running (port 5000)
- [ ] Frontend running (port 3000)
- [ ] Browser open at http://localhost:3000
- [ ] Account created
- [ ] Dashboard visible
- [ ] Transaction added
- [ ] Card added

---

## 🚀 Quick Commands Reference

```bash
# Install dependencies
npm install

# Start MongoDB (Terminal 1)
mongod

# Start backend (Terminal 2)
npm run dev

# Start frontend (Terminal 3)
node serve-frontend.js

# Open browser
http://localhost:3000
```

---

## 💡 Pro Tips

1. **Keep all 3 terminals open** while developing
2. **Use Ctrl+C** to stop servers
3. **Check terminal logs** for errors
4. **Use browser DevTools** (F12) to debug
5. **Test on different browsers** (Chrome, Edge, Firefox)

---

## 🎨 What to Expect

### **Visual Design:**
- Dark navy background (#0a0e27)
- Neon blue accents (#00d4ff)
- Glassmorphism cards
- Smooth animations
- Premium FinTech look

### **Functionality:**
- Instant balance updates
- Real-time transaction list
- Beautiful card designs
- Interactive charts
- Smooth page transitions

---

## 📞 Need Help?

1. Check terminal logs for errors
2. Verify all 3 servers are running
3. Check browser console (F12)
4. Review README.md for detailed docs
5. Check VISUAL_PREVIEW.md for design details

---

**🟦 Spendify** - Smart Spending. Clear Insights.

**Ready to launch on localhost!** 🚀

Follow the steps above and you'll have the full application running in minutes!
