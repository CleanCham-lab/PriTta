@echo off
rem Double-click to build PriTta.exe on Windows (needs Python for Windows 3.9+).
setlocal
cd /d "%~dp0"
echo.
echo  [PriTta] Building PriTta.exe ...
echo.

set "PY="
py -3 --version >nul 2>nul && set "PY=py -3"
if not defined PY python --version >nul 2>nul && set "PY=python"
if not defined PY goto nopython

if not exist ".build-venv\Scripts\python.exe" (
  %PY% -m venv .build-venv || goto fail
)
".build-venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".build-venv\Scripts\python.exe" -m pip install -r requirements.txt pyinstaller || goto fail
".build-venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean PriTta.spec || goto fail

copy /y "dist\PriTta.exe" "%~dp0PriTta.exe" >nul
copy /y "dist\pritta-cli.exe" "%~dp0pritta-cli.exe" >nul
echo.
echo  Done!  %~dp0PriTta.exe
echo.
pause
exit /b 0

:nopython
echo  Python for Windows was not found.
echo  Install it with:   winget install -e --id Python.Python.3.12
echo  or from https://www.python.org/downloads/  and run this file again.
echo.
pause
exit /b 1

:fail
echo.
echo  Build failed. See the messages above.
echo.
pause
exit /b 1
