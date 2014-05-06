cd ~/git/Cercando

echo Killing old server process, if existing
killall node

scripts/compileTypeScript.sh

echo Starting Lucy server
node LucyServer/js/server/LucyServer.js
