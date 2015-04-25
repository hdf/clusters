#!/bin/sh

forever -w --minUptime 1000 --spinSleepTime 1000 server --port 8082 --forever
#forever start -w --minUptime 1000 --spinSleepTime 1000 server --port 8082 --forever
