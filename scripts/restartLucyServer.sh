export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

if [ "$1" = "--daemon" ]; then
sudo launchctl stop com.oblomov.lucyServer
# automatically restarted by launchd
else
scripts/killLucyServer.sh
sleep 1
# Start a normal server, and pass optional 'remoteReader' arg in $1
scripts/startLucyServer.sh $1
fi
