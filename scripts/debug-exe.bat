@echo off
REM Debug launcher for the packaged exe — keeps the console open on errors
REM Usage: double-click this file, or run from cmd: scripts\debug-exe.bat

set DEBUG=1

if exist "%~dp0..\dist\local-ai-proxy-windows.exe" (
    echo Starting Local AI Proxy in debug mode...
    echo.
    "%~dp0..\dist\local-ai-proxy-windows.exe" --debug
) else (
    echo ERROR: dist\local-ai-proxy-windows.exe not found.
    echo Run "npm run dist:win" first to build the executable.
)

echo.
echo --- Process exited ---
pause
