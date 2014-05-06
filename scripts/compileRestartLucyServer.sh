cd ~/git/Cercando

nodePid=`pgrep -f "node.*LucyServer.js"`
if [ -n "$nodePid" ]; then
echo "Killing active process"
kill $nodePid
sleep 2
fi

scripts/compileTypeScript.sh

echo Starting Lucy server
scripts/restartLucyServer.sh $1