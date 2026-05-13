@echo off
echo Installation Social Connect Platform...
npm install
copy .env.example .env
echo.
echo Ouvre le fichier .env et ajoute tes cles Supabase.
echo Puis lance : npm run dev
pause
