export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando
echo Compiling LucyServer
tsc -m commonjs -t ES5 LucyServer/js/server/LucyServer.ts
if [ "$?" -ne "0" ]; then
    echo "ERROR: compilation failed, exiting script"
    exit 1
fi

echo Compiling Client scripts
tsc -m commonjs -t ES5 LucyServer/js/client/Locator.ts
if [ "$?" -ne "0" ]; then
    exit 1
fi
