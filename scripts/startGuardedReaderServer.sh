export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

runServer="java -cp ReaderServer/resources:ReaderServer/bin:ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar readerServer.Main"

until $runServer $1 ; do
    echo "Reader server crashed with exit code $?. Respawning.." >&2
    sleep 1
done