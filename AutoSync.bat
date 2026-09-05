@echo off
cd /d "g:\My Drive\Code app\dev_projects\crm-mini"
title Auto Sync Github - CRM Mini
color 0A
echo ===================================================
echo     HE THONG TU DONG DONG BO CODE LEN GITHUB
echo ===================================================
echo.
echo He thong dang chay ngam. Cu moi 60 giay se kiem tra 
echo va tu dong day code moi len Github/Vercel.
echo (De dung lai, chi can tat cua so nay)
echo.

:loop
git status --porcelain > temp_git_status.txt
for /f %%i in ("temp_git_status.txt") do set size=%%~zi
if %size% gtr 0 (
    echo [%time%] Phat hien code moi! Dang day len Github...
    git add .
    git commit -m "Auto-sync code update"
    git push
    echo [%time%] Da dong bo thanh cong!
)
del temp_git_status.txt
timeout /t 60 >nobreak
goto loop
