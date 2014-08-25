export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

echo "########## startLucyServer.sh: Starting Lucy server"

# make sure Synology NAS is mounted before starting the server
./scripts/waitUntilNasMounted.sh

# Start a normal server, and pass optional 'remoteReader' arg in $1
node LucyServer/js/server/LucyServer.js $1
