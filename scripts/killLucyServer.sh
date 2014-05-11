export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# Kill Lucy web server

nodePid=`pgrep -f "node.*LucyServer.js"`
if [ -n "$nodePid" ]; then
echo "Killing active process"
kill $nodePid
fi
