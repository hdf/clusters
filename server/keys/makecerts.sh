#!/bin/sh

if [ "$1" == "" ]; then
  echo You must specify a host name as parameter, like this: ./makecerts.sh example.com
  exit
fi
host=$1

#openssl dhparam -out dh4096.pem 4096
if [ ! -f ./root.key ]; then
  openssl ecparam -genkey -name secp521r1 -out root.key
fi
if [ ! -f ./root.crt ]; then
  openssl req -new -x509 -nodes -sha512 -days 3650 -key root.key -out root.crt -subj "/C=HU/ST=Pest/L=Budapest/emailAddress=admin@$host/CN=\\$host Root CA"
fi

if [ ! -f ./server.key ]; then
  openssl ecparam -genkey -name secp521r1 -out server.key
fi

cnf=server.cnf
if [ ! -f ./$cnf ]; then
  printf "\
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = *.$host
DNS.2 = $host
DNS.3 = localhost
">$cnf
  madecnf=1
fi

if [ ! -f ./server.crt ]; then
  openssl req -new -nodes -key server.key -out server.csr -subj "/C=HU/ST=Pest/L=Budapest/emailAddress=admin@$host/CN=\\$host"
  openssl x509 -req -in server.csr -sha512 -days 365 -CA root.crt -CAkey root.key -CAcreateserial -extensions v3_req -extfile $cnf -out server.crt
  rm server.csr
fi

if [ "$madecnf" == "1" ]; then rm $cnf; fi

if [ -f ./.rnd ]; then rm .rnd; fi
if [ -f ./root.srl ]; then rm root.srl; fi
