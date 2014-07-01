export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# Start a normal server, and pass optional 'remoteReader' arg in $1
node LucyServer/js/server/LucyServer.js $1
