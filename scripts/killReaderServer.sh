export PATH=/usr/local/bin:$PATH
cd ~/git/Cercando

# Kill both the java reader server and its wrapper script

javaPid=`pgrep -f "java.*readerServer.Main"`
if [ -n "$javaPid" ]; then
echo "Killing active reader server process"
kill $javaPid
fi

wrapperPid=`pgrep -f "bash scripts/startGuardedReaderServer"`
if [ -n "$wrapperPid" ]; then
echo "Killing active wrapper script"
kill $wrapperPid
fi
