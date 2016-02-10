@echo off
cls

taskkill /F /IM node.exe > nul
rem node-debug -p 5859 server
rem set DEBUG=compression
forever -w --minUptime 1000 --spinSleepTime 1000 server --port 8082 --forever --push
rem forever start -w --minUptime 1000 --spinSleepTime 1000 server --port 8082 --forever
rem start https://localhost:8082/
