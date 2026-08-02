@echo off
chcp 65001 >nul 2>&1
title 安装依赖 - 任职资格认证 AI 初筛系统
echo.
echo   ==========================================
echo   🏆 安装依赖中，请稍候...
echo   ==========================================
echo.

cd /d "%~dp0"

:: find python
set PY_CMD=
where py >nul 2>&1 && set PY_CMD=py
if "%PY_CMD%"=="" where python >nul 2>&1 && set PY_CMD=python
if "%PY_CMD%"=="" (
    echo   [错误] 请先安装 Python 3.10+
    echo   下载: https://www.python.org/downloads/
    echo   安装时请勾选 "Add Python to PATH"
    pause
    exit /b 1
)

echo   Python: %PY_CMD%
echo.

%PY_CMD% -m pip install flask anthropic pdfplumber python-pptx openpyxl

echo.
echo   ==========================================
echo   ✅ 安装完成！双击 start.bat 启动
echo   ==========================================
echo.
pause
