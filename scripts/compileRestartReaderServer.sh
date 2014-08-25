export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/compileReaderServer.sh

scripts/restartReaderServer.sh $1