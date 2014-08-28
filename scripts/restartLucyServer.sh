export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

scripts/stopLucyServer.sh $*
scripts/startLucyServer.sh $*
