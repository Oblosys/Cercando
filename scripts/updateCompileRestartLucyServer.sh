export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

echo "Updating Cercando repository with git pull"
git pull
if [ "$?" -ne "0" ]; then
    echo "ERROR: git pull failed, exiting script"
    exit 1
fi

# Pass optional '--daemon' and '--remoteReader' args in $*
scripts/compileRestartLucyServer.sh $*
