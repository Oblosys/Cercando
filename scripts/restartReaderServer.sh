export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/stopReaderServer.sh
# Give the server some time to gracefully disconnect from the readers
sleep 1
scripts/startReaderServer.sh
 