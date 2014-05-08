export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/killReaderServer.sh

rm -rf ReaderServer/bin/readerServer

javac -cp ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar -sourcepath ReaderServer/src -d ReaderServer/bin/ ReaderServer/src/readerServer/*.java

scripts/restartReaderServer.sh $1