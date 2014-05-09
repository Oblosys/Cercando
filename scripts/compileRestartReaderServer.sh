export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/killReaderServer.sh

rm -rf ReaderServer/bin/readerServer

echo Compiling reader server
javac -cp ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar -sourcepath ReaderServer/src -d ReaderServer/bin/ ReaderServer/src/readerServer/*.java
if [ "$?" -ne "0" ]; then
    echo "ERROR: compilation failed, exiting script"
    exit 1
fi

scripts/restartReaderServer.sh $1