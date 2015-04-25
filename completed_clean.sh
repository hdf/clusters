#!/bin/sh

rm ./server/db/completed.json
/bin/find . -name "*.changes" -delete
/bin/find . -name "*_results.json" -delete

gnome-open ./server/db/projects.json
