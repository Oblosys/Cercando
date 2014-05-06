cd ~/git/Cercando

javaPid=`pgrep -f "java.*readerServer.Main"`
if [ -n "$javaPid" ]; then
echo "Killing active process"
kill $javaPid
fi

rm -rf ReaderServer/bin/readerServer

javac -cp ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar -sourcepath ReaderServer/src -d ReaderServer/bin/ ReaderServer/src/readerServer/*.java

scripts/restartReaderServer.sh $1