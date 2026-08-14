@echo off
echo ==============================================
echo       KHOI DONG HE THONG CRM MINI LOCAL
echo ==============================================
echo.

cd /d "%~dp0"

set PYTHON_CMD=python

python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [LOI] Khong tim thay Python hoac lenh 'py'! Vui long cai dat Python.
        echo Vui long truy cap: https://www.python.org/downloads/
        pause
        exit /b
    ) else (
        set PYTHON_CMD=py
    )
)

echo Dang khoi dong may chu bang %PYTHON_CMD%...
%PYTHON_CMD% server.py
pause
