@echo off
chcp 65001 >nul 2>&1
title 任职资格认证 AI 初筛系统
echo.
echo   ==========================================
echo   🏆 任职资格认证 AI 初筛系统  v2.0
echo   ==========================================
echo.
echo   [启动] 正在启动服务...
echo.

cd /d "%~dp0"

:: try py launcher first, then python, then python3
set PY_CMD=
where py >nul 2>&1 && set PY_CMD=py
if "%PY_CMD%"=="" where python >nul 2>&1 && set PY_CMD=python
if "%PY_CMD%"=="" where python3 >nul 2>&1 && set PY_CMD=python3
if "%PY_CMD%"=="" (
    echo   [错误] 未找到 Python，请先安装 Python 3.10+
    echo   下载地址: https://www.python.org/downloads/
    echo   安装时请勾选 "Add Python to PATH"
    pause
    exit /b 1
)

echo   Python: %PY_CMD%
echo   地址:   http://localhost:5890
echo   按 Ctrl+C 可停止服务
echo.

:: 检查依赖是否已安装
%PY_CMD% -c "import flask" 2>nul
if errorlevel 1 (
    echo   [提示] 首次运行，正在安装依赖...
    %PY_CMD% -m pip install -r requirements.txt --quiet
    echo   [完成] 依赖安装完毕
    echo.
)

%PY_CMD% app.py

if errorlevel 1 (
    echo.
    echo   [错误] 启动失败，请检查上方报错信息
    echo   常见问题:
    echo   1. 缺少依赖: 双击 setup_install.bat 安装
    echo   2. 端口被占用: 检查 5890 端口是否被其他程序占用
    echo   3. 缺少环境变量: 确保已设置 DEEPSEEK_API_KEY
    pause
)
