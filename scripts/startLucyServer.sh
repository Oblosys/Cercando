export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

echo "########## startLucyServer.sh: Starting Lucy server"

if [ "$1" != "--remoteReader" ]; then
# make sure Synology NAS is mounted before starting the server
./scripts/waitUntilNasMounted.sh
fi

# Start a normal server, and pass optional '--remoteReader' arg in $1
node LucyServer/js/server/LucyServer.js $1
