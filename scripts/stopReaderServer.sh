export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

if [ "$1" = "--daemon" ]; then
sudo launchctl unload /Library/LaunchDaemons/com.oblomov.readerServer.plist
else
scripts/killReaderServer.sh
fi
