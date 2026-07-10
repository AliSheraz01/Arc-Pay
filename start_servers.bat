@echo off
title Arc Pay Starter

echo [1/3] Starting Backend Server...
start cmd /k "cd /d E:\Arc pay\backend && npm run dev"

echo [2/3] Starting Frontend Server...
start cmd /k "cd /d E:\Arc pay\frontend && npm run dev"

echo [3/3] Waiting 5 seconds for servers to start...
timeout /t 5 /nobreak > nul

echo Opening Arc Pay web app in your browser...
start http://localhost:3000

echo All set! You can close this starter window. The servers will keep running in their own windows.
pause
