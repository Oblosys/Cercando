export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

runServer="node LucyServer/js/server/LucyServer.js"

scripts/killLucyServer.sh
sleep 1

if [ "$1" = "--daemon" ]; then
$runServer </dev/null >/dev/null 2>&1 &
else
# Start a normal server, and pass optional 'remoteReader' arg in $1
$runServer $1
fi
