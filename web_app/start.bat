@echo off
chcp 65001 >nul 2>&1
title 任职资格认证 AI 初筛系统
echo.
echo   ==========================================
echo   🏆 任职资格认证 AI 初筛系统  v1.0
echo   ==========================================
echo.
echo   [启动] 正在启动服务...
echo.

cd /d "%~dp0"

:: try py launcher first, then python, then full path
set PY_CMD=
where py >nul 2>&1 && set PY_CMD=py
if "%PY_CMD%"=="" where python >nul 2>&1 && set PY_CMD=python
if "%PY_CMD%"=="" if exist "C:\Users\12113\AppData\Local\Programs\Python\Python312\python.exe" set PY_CMD=C:\Users\12113\AppData\Local\Programs\Python\Python312\python.exe
if "%PY_CMD%"=="" if exist "C:\Python312\python.exe" set PY_CMD=C:\Python312\python.exe
if "%PY_CMD%"=="" (
    echo   [错误] 未找到 Python，请先安装 Python
    echo   下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo   Python: %PY_CMD%
echo   地址:   http://localhost:5890
echo   按 Ctrl+C 可停止服务
echo.

%PY_CMD% app.py

if errorlevel 1 (
    echo.
    echo   [错误] 启动失败，请检查上方报错信息
    pause
)
