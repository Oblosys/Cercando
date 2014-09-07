export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# This script assumes Lucy Server is not running
echo "Compiling LucyServer"
tsc -m commonjs -t ES5 LucyServer/js/server/LucyServer.ts
if [ "$?" -ne "0" ]; then
    echo "Typescript error in LucyServer"
    exit 1
fi

echo Compiling Client scripts
tsc -m commonjs -t ES5 LucyServer/js/client/Locator.ts
if [ "$?" -ne "0" ]; then
    echo "Typescript error in Locator"
    exit 1
fi

echo Compiling user manager
tsc -m commonjs -t ES5 LucyServer/js/tools/UserManager.ts
if [ "$?" -ne "0" ]; then
    echo "Typescript error in UserManager"
    exit 1
fi
