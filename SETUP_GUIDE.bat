@echo off
echo.
echo ========================================
echo   🟦 SPENDIFY - Setup Instructions
echo ========================================
echo.
echo Due to PowerShell restrictions, please follow these steps:
echo.
echo ========================================
echo STEP 1: Fix PowerShell (One-time setup)
echo ========================================
echo.
echo Open PowerShell as Administrator and run:
echo   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
echo.
echo Then press Y to confirm.
echo.
pause
echo.
echo ========================================
echo STEP 2: Install Dependencies
echo ========================================
echo.
echo After fixing PowerShell, run:
echo   npm install
echo.
pause
echo.
echo ========================================
echo STEP 3: Start MongoDB
echo ========================================
echo.
echo Open a NEW terminal and run:
echo   mongod
echo.
echo Keep that terminal open.
echo.
pause
echo.
echo ========================================
echo STEP 4: Start Backend Server
echo ========================================
echo.
echo Open another NEW terminal and run:
echo   cd c:\Users\Manoj\spendiFy
echo   npm run dev
echo.
echo Backend will start on: http://localhost:5000
echo.
pause
echo.
echo ========================================
echo STEP 5: Open Frontend
echo ========================================
echo.
echo Option A - Direct File Access:
echo   Navigate to: c:\Users\Manoj\spendiFy\client
echo   Double-click: index.html
echo.
echo Option B - Using Live Server (VS Code):
echo   1. Install "Live Server" extension in VS Code
echo   2. Right-click on index.html
echo   3. Select "Open with Live Server"
echo.
echo Option C - Python HTTP Server:
echo   cd c:\Users\Manoj\spendiFy\client
echo   python -m http.server 3000
echo   Then open: http://localhost:3000
echo.
pause
echo.
echo ========================================
echo   ✅ SETUP COMPLETE!
echo ========================================
echo.
echo Your Spendify app will be running on:
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000 (or file://)
echo.
echo Next Steps:
echo   1. Open the frontend URL
echo   2. Register a new account
echo   3. Login and explore!
echo.
pause
