export PATH=.:~/git/Cercando/scripts:$PATH
export PS1='\[\033[1;36m\]Lucy:\w> \[\033[0m\]'
export EDITOR=emacs

export HISTCONTROL=ignoredups
# arrow keys select in history
bind '"[A":history-search-backward'
bind '"[B":history-search-forward'

alias ls="ls -al"
alias lss="/bin/ls"

alias cerc="cd ~/git/Cercando"

alias monitor-lucy="tail -f ~/lucyData/logs/lucyServer.log"
alias monitor-reader="tail -f ~/lucyData/logs/readerServer.log"
alias update-lucy="~/git/Cercando/scripts/updateCompileRestartLucyServer.sh --daemon"
alias update-reader="~/git/Cercando/scripts/updateCompileRestartReaderServer.sh --daemon"
alias restart-lucy="~/git/Cercando/scripts/restartLucyServer.sh --daemon"
alias restart-reader="~/git/Cercando/scripts/restartReaderServer.sh --daemon"

