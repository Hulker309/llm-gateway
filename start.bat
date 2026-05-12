@echo off
title LLM Gateway Control
cd /d "D:\Game and Files\develop\mcp-tools\llm-gateway"

:: Kill old gateway on port 3456 if any
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456 " ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Start gateway minimized (run in background)
start /MIN "LLM Gateway" "C:\Program Files\nodejs\node.exe" index.js
ping -n 3 127.0.0.1 >nul

:: Open browser
start "" http://localhost:3456

echo.
echo   LLM Gateway is running
echo   Admin: http://localhost:3456
echo.
echo   Press any key to stop gateway...
pause >nul

:: Kill gateway by port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3456 " ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo   Gateway stopped.