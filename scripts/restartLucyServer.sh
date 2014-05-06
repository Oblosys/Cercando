cd ~/git/Cercando

runServer="node LucyServer/js/server/LucyServer.js"

nodePid=`pgrep -f "node.*LucyServer.js"`
if [ -n "$nodePid" ]; then
echo "Killing active process"
kill $nodePid
sleep 2
fi

# --daemon implies we're running on Lucy's Mac, so we use port 80 and a local reader server
if [ "$1" = "--daemon" ]; then
$runServer 80 </dev/null >/dev/null 2>&1 &
else
$runServer
fi

