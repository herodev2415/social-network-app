@echo off
echo Nettoyage ancien npm...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo Installation...
npm install
echo.
echo Lance maintenant :
echo npm run dev
pause
