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


# >/dev/null 2>&1 &
until $runServer </dev/null >>~/tempLogs/readerServer.log 2>&1 ; do
    echo "Reader server crashed with exit code $?. Respawning.." >&2
    sleep 1
done

else
$runServer
fi

