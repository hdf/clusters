#!/bin/sh

# Usage: gen 20 project.json

n=10
f=nums.json
s=

if [ "$1" != "" ]; then
  n=$1
fi
if [ "$2" != "" ]; then
  f=$2
fi

for ((i=0; i<$n; i++)); do
  s=$s,$i
done

echo [${s:1}]>$f
