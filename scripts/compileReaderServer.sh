export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# This script assumes Reader Server is not running
rm -rf ReaderServer/bin/readerServer

echo "Compiling reader server"
javac -cp ReaderServer/lib/ltkjava-1.0.0.7-with-dependencies.jar -sourcepath ReaderServer/src -d ReaderServer/bin/ ReaderServer/src/readerServer/*.java
if [ "$?" -ne "0" ]; then
    echo "Java compilation error"
    exit 1
fi
