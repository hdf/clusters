@echo off
cls
echo. 2>"server\db\completed.json"
echo. 2>"server\db\completed.changes"
echo. 2>"server\db\projects.changes"
echo. 2>"server\db\projects\test_results.changes"
echo. 2>"server\db\projects\test_results.json"
echo. 2>"server\db\projects\test3_results.changes"
echo. 2>"server\db\projects\test3_results.json"
echo. 2>"server\db\projects\emscripten demo_results.changes"
echo. 2>"server\db\projects\emscripten demo_results.json"

start server\db\projects.json
