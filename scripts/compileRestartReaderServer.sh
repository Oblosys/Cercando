export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/stopReaderServer.sh $1
scripts/compileReaderServer.sh
if [ "$?" -ne "0" ]; then
    echo "ERROR: compilation failed, exiting script"
    exit 1
fi
scripts/startReaderServer.sh $1
