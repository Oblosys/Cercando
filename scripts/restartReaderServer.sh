export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

runServer="java -cp ReaderServer/resources:ReaderServer/bin:ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar readerServer.Main"

scripts/killReaderServer.sh
sleep 1

if [ "$1" = "--daemon" ]; then
bash scripts/startGuardedReaderServer.sh </dev/null >>~/lucyData/logs/readerServer.log 2>&1 &
else
$runServer
fi
