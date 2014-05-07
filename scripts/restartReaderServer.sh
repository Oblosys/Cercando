export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

runServer="java -cp ReaderServer/bin:ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar readerServer.Main"

javaPid=`pgrep -f "java.*readerServer.Main"`
if [ -n "$javaPid" ]; then
echo "Killing active process"
kill $javaPid
sleep 2
fi

if [ "$1" = "--daemon" ]; then
$runServer </dev/null >/dev/null 2>&1 &
else
$runServer
fi

