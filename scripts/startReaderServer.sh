export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

echo "########## startReaderServer.sh: Starting Reader server"

if [ "$1" == "--daemon" ]; then
# The reader server does not access the NAS, so unlike the Lucy server we do not need to wait
# until it has mounted, unless we start logging to the NAS again. Logging to the NAS is probably not
# a good idea though, since any interruptions in the connection may completely stop all logging.
sudo launchctl load /Library/LaunchDaemons/com.oblomov.readerServer.plist
else
java -cp ReaderServer/resources:ReaderServer/bin:ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar readerServer.Main
fi
