export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# Kill Java reader server

javaPid=`pgrep -f "java.*readerServer.Main"`
if [ -n "$javaPid" ]; then
echo "Killing active reader server process"
kill $javaPid
fi
