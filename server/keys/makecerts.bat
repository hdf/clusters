@echo off
cls
if "%1"=="" goto blank
set host=%1

rem openssl dhparam -out dh4096.pem 4096
rem Google decided to fuck us, so no more secp521r1: https://code.google.com/p/chromium/issues/detail?id=477623
if not exist root.key openssl ecparam -genkey -name secp384r1 -out root.key
if not exist root.crt openssl req -new -x509 -nodes -sha512 -days 3650 -key root.key -out root.crt -subj "/C=HU/ST=Pest/L=Budapest/emailAddress=admin@%host%/CN=\%host% Root CA"

if not exist server.key openssl ecparam -genkey -name secp384r1 -out server.key

set cnf=server.cnf
if exist %cnf% goto gotcnf
(
  echo [req]
  echo distinguished_name = req_distinguished_name
  echo req_extensions = v3_req
  echo.
  echo [req_distinguished_name]
  echo.
  echo [ v3_req ]
  echo basicConstraints = CA:FALSE
  echo keyUsage = nonRepudiation, digitalSignature, keyEncipherment
  echo subjectAltName = @alt_names
  echo.
  echo [alt_names]
  echo DNS.1 = *.%host%
  echo DNS.2 = %host%
  echo DNS.3 = localhost
  echo.
)>%cnf%
set madecnf=1
:gotcnf

if not exist server.crt (
  openssl req -new -nodes -key server.key -out server.csr -subj "/C=HU/ST=Pest/L=Budapest/emailAddress=admin@%host%/CN=\%host%"
  openssl x509 -req -in server.csr -sha512 -days 365 -CA root.crt -CAkey root.key -CAcreateserial -extensions v3_req -extfile %cnf% -out server.crt
  del server.csr
)

if "%madecnf%"=="1" del %cnf%
set madecnf=
set cnf=
set host=

if exist .rnd del .rnd
if exist root.srl del root.srl
goto end

:blank
echo You must specify a host name as parameter, like this: makecerts example.com
:end
