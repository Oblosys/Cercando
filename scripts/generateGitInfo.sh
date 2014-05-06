#!/bin/sh

# Generate JSON object that contains several constants reflecting the git state for the current build.
cd ~/git/Cercando

kShortSHA=`git rev-parse --short HEAD`

kCurrentBranch=`git rev-parse --abbrev-ref HEAD`

# A bit verbose, but doesn't fail for missing remotes
kRemoteTracking=`git for-each-ref --format='%(upstream:short)' $(git symbolic-ref -q HEAD) | head -1`

git diff --quiet
if [ $? -ne 0 ]; then
    kIsDirty=true
else
    kIsDirty=false
fi

echo "{\"shortSHA\": \"${kShortSHA}\", \"currentBranch\": \"${kCurrentBranch}\", \"remoteTracking\": \"${kRemoteTracking}\", \"isDirty\": ${kIsDirty}}"

