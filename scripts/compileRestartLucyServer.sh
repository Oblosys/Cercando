export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

nodePid=`pgrep -f "node.*LucyServer.js"`
if [ -n "$nodePid" ]; then
echo "Killing active process"
kill $nodePid
sleep 2
fi

scripts/compileTypeScript.sh
if [ "$?" -ne "0" ]; then
    echo "ERROR: compilation failed, exiting script"
    exit 1
fi

echo Starting Lucy server
scripts/restartLucyServer.sh $1