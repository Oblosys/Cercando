export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

if [ "$1" = "--daemon" ]; then
sudo launchctl stop com.oblomov.readerServer
# automatically restarted by launchd
else
scripts/killReaderServer.sh
sleep 1
scripts/startReaderServer.sh
fi
 