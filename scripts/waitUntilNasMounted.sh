# Don't exit until mounted NAS is available through the symbolic link ~/lucy/data
# By checking the existence, automount should take care of mounting the volume.
# This may fail a couple of times if the network is not available yet while booting.
echo "Checking whether Synology NS has been mounted.."
while [ ! -d /Users/NHMR/lucy/data/savedReaderEvents ]
do
   echo "Not mounted yet, waiting 5 seconds.."
   sleep 5
done
echo "Done: Synology NAS has been mounted." 
