@echo off
chcp 65001 >nul
title RPJG 影音流體極速下載終端 - 本地極速核心
color 0b

echo ======================================================
echo    🚀 RPJG 影音流體極速下載終端 (本地極速核心)
echo    專為解決 YouTube 雲端機房 429 限制而設計
echo    官方支援 Discord: https://discord.gg/MDrNBbCBXz
echo ======================================================
echo.

:: 1. 檢查是否安裝 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌ 錯誤] 系統未檢測到 Node.js 環境！
    echo 本地下載引擎需要 Node.js 才能運作。
    echo 正在為您自動開啟 Node.js 官網 (請下載安裝 LTS 版本，下一步到底即可)...
    start https://nodejs.org/
    echo.
    echo 安裝完成後，請重新雙擊此檔案即可！
    pause
    exit /b
)

:: 2. 檢查 node_modules
if not exist "node_modules" (
    echo [📦 首次啟動] 正在安裝必要套件，請稍候約 30 秒...
    call npm install
)

echo.
echo [✅ 啟動成功] 正在為您開啟瀏覽器...
echo 網址: http://localhost:3005
echo.

:: 延遲 2 秒後在預設瀏覽器開啟網址
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3005"

:: 啟動後端
node server/index.js

pause
