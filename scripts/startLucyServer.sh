export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

echo "########## startLucyServer.sh: Starting Lucy server"

if [ "$1" == "--daemon" ]; then
# make sure Synology NAS is mounted before starting the server
./scripts/waitUntilNasMounted.sh
sudo launchctl load /Library/LaunchDaemons/com.oblomov.lucyServer.plist
else
# Start a normal server, and pass optional '--remoteReader' arg in $1 (cannot be '--daemon')
node LucyServer/js/server/LucyServer.js $1
fi
