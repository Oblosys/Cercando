export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

runServer="node LucyServer/js/server/LucyServer.js"

nodePid=`pgrep -f "node.*LucyServer.js"`
if [ -n "$nodePid" ]; then
echo "Killing active process"
kill $nodePid
sleep 2
fi

if [ "$1" = "--daemon" ]; then
$runServer </dev/null >/dev/null 2>&1 &
else
$runServer
fi

