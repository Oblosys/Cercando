echo Compiling LucyServer
/usr/local/bin/tsc -m commonjs -t ES5 LucyServer/js/server/LucyServer.ts
echo Compiling Client scripts
/usr/local/bin/tsc -m commonjs -t ES5 LucyServer/js/client/Locator.ts
