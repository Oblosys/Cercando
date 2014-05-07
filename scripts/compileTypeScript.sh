export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando
echo Compiling LucyServer
tsc -m commonjs -t ES5 LucyServer/js/server/LucyServer.ts
echo Compiling Client scripts
tsc -m commonjs -t ES5 LucyServer/js/client/Locator.ts
