@echo off
title Iniciar Plataforma EuSou
echo ========================================================
echo   Iniciando Plataforma EuSou (Backend + Frontend)
echo ========================================================
echo.

echo [1/2] Iniciando Backend na porta 3000...
start "EuSou - Backend (Porta 3000)" cmd /k "cd /d %~dp0backend && node dist/main.js"

echo [2/2] Iniciando Frontend na porta 5173...
start "EuSou - Frontend (Porta 5173)" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 0.0.0.0"

echo.
echo ========================================================
echo   Servidores iniciados em segundo plano!
echo   - Loja e Painel Admin: http://localhost:5173
echo   - Backend API:         http://localhost:3000
echo ========================================================
echo.
pause
