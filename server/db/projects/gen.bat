rem Usage: gen 20 project.json
@echo off
cls
setlocal Enabledelayedexpansion

set n=10
set f=nums.json
set s=

if "%1"=="" goto noparam1
set n=%1
:noparam1
SET /A n = %n% - 1

if "%2"=="" goto noparam2
set f=%2
:noparam2

FOR /L %%i IN (0,1,%n%) DO set s=!s!,%%i

set s=[%s:~1%]
echo %s%>%f%

set n=
set f=
set s=
