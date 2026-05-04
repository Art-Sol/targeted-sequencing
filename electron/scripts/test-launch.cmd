@echo off
rem Локальный launcher для разработки. Снимает ELECTRON_RUN_AS_NODE,
rem которая может стоять в env-окружении разработчика и заставит .exe
rem стартовать в режиме Node.js (без app/BrowserWindow → молча умирает).
rem Конечному пользователю этот файл не нужен — у него переменной нет.
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0Targeted Sequencing.exe"
