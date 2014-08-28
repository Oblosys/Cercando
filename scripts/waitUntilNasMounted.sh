# Don't exit until mounted NAS is available through the symbolic link ~/lucyData
# By checking the existence, automount should take care of mounting the volume.
# This may fail a couple of times if the network is not available yet while booting.
echo "Checking whether Synology NS has mounted"
while [ ! -d /Users/NHMR/lucyData/savedReaderEvents ]
do
   echo "Synology NAS is not mounted yet, waiting 5 seconds."
   sleep 5
done

