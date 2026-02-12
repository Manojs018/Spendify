@echo off
echo.
echo ========================================
echo   Installing Spendify Dependencies
echo ========================================
echo.

REM Try to install using cmd instead of PowerShell
echo Installing npm packages...
echo.

call npm install --no-optional 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ Installation Successful!
    echo ========================================
    echo.
    echo Dependencies installed successfully.
    echo.
    echo Next steps:
    echo   1. Start MongoDB: mongod
    echo   2. Start backend: npm run dev
    echo.
) else (
    echo.
    echo ========================================
    echo   ⚠️  Installation Failed
    echo ========================================
    echo.
    echo Please run PowerShell as Administrator and execute:
    echo   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo.
    echo Then run this script again.
    echo.
)

pause
