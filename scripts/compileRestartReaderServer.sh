cd ~/git/Cercando

killall java

rm -rf ReaderServer/bin/readerServer

javac -cp ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar -sourcepath ReaderServer/src -d ReaderServer/bin/ ReaderServer/src/readerServer/*.java

java -cp ReaderServer/bin:ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar readerServer.Main