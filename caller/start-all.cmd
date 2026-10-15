@echo off
rem Starts the Cally caller: controller, connector, gateway and an ngrok tunnel, each in its own window.
rem Copy the https address ngrok shows into CALLER_URL in ..\.env.local, then restart the app.
cd /d %~dp0
start "Cally controller" cmd /k npm.cmd run start:controller
start "Cally connector" cmd /k npm.cmd run start:connector
start "Cally gateway" cmd /k npm.cmd run start:gateway
start "ngrok" cmd /k ngrok http 8000
