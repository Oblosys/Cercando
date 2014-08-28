export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando


scripts/stopLucyServer.sh $*
scripts/compileLucyServer.sh
if [ "$?" -ne "0" ]; then
    echo "ERROR: compilation failed, exiting script"
    exit 1
fi
scripts/startLucyServer.sh $*
