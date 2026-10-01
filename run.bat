@echo off
title AuraStream - Local Server
echo Starting AuraStream...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH! Please install Python 3.
    pause
    exit /b 1
)

if not exist venv\ (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing requirements...
pip install -r requirements.txt >nul

echo Starting the server...
python app.py
pause
