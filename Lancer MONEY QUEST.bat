@echo off
title MONEY QUEST
cd /d "%~dp0"
if not exist node_modules (
  echo Installation des dependances, une seule fois...
  call npm install
)
start "" http://localhost:5173
call npm run dev -- --port 5173
