@echo off
echo ========================================
echo Starting DQN RL System
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if MongoDB is running
echo [1/4] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if errorlevel 1 (
    echo [WARNING] MongoDB is not running!
    echo Please start MongoDB first
    pause
    exit /b 1
)
echo [OK] MongoDB is running

REM Install Python dependencies
echo.
echo [2/4] Installing Python dependencies...
cd python_rl_service
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)
echo [OK] Python dependencies installed

REM Start Python DQN service in new window
echo.
echo [3/4] Starting Python DQN service...
start "Python DQN Service" cmd /k "python app.py"
timeout /t 3 >nul
echo [OK] Python DQN service started on http://localhost:8000

REM Start Node.js backend
echo.
echo [4/4] Starting Node.js backend...
cd ..
start "Node.js Backend" cmd /k "node backend/api.js"
timeout /t 2 >nul
echo [OK] Node.js backend started on http://localhost:5000

echo.
echo ========================================
echo System Ready!
echo ========================================
echo.
echo Services:
echo   - Python DQN: http://localhost:8000
echo   - Node.js API: http://localhost:5000
echo   - Dashboard: http://localhost:5000/dashboard
echo.
echo Press any key to test the system...
pause >nul

REM Run test
cd python_rl_service
python test_dqn.py

pause
