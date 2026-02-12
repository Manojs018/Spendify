@echo off
echo.
echo ========================================
echo   🟦 SPENDIFY - Development Server
echo   Smart Spending. Clear Insights.
echo ========================================
echo.

echo [1/3] Checking MongoDB...
echo.

REM Check if MongoDB is running
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ MongoDB is running
) else (
    echo ⚠️  MongoDB is not running
    echo.
    echo Please start MongoDB first:
    echo   1. Open a new terminal
    echo   2. Run: mongod
    echo.
    pause
    exit
)

echo.
echo [2/3] Starting Backend Server...
echo.

start "Spendify Backend" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo ✅ Backend started on http://localhost:5000
echo.
echo [3/3] Opening Frontend...
echo.

REM Open the login page in default browser
start "" "client/index.html"

echo.
echo ========================================
echo   ✅ SPENDIFY IS READY!
echo ========================================
echo.
echo 📡 Backend API: http://localhost:5000
echo 🌐 Frontend: client/index.html
echo.
echo 📚 Quick Tips:
echo   - Register a new account
echo   - Login to access dashboard
echo   - Add transactions and cards
echo   - Explore analytics
echo.
echo Press Ctrl+C in the backend window to stop
echo ========================================
echo.
pause
