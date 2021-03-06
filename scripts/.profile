export PATH=.:~/git/Cercando/scripts:$PATH
export PS1='\[\033[1;36m\]Lucy:\w> \[\033[0m\]'
export EDITOR=emacs

export HISTCONTROL=ignoredups
# arrow keys select in history. Note: create ^[[A and ^[[B in nano with verbatim mode ESC-V Arrow Up/Down
bind '"[A":history-search-backward'
bind '"[B":history-search-forward'

alias ls="ls -al"
alias lss="/bin/ls"

alias cerc="cd ~/git/Cercando"

alias monitor-lucy="tail -f ~/lucy/log/lucyServer.log"
alias monitor-reader="tail -f ~/lucy/log/readerServer.log"
alias update-lucy="~/git/Cercando/scripts/updateCompileRestartLucyServer.sh --daemon"
alias update-reader="~/git/Cercando/scripts/updateCompileRestartReaderServer.sh --daemon"
alias restart-lucy="~/git/Cercando/scripts/restartLucyServer.sh --daemon"
alias restart-reader="~/git/Cercando/scripts/restartReaderServer.sh --daemon"
alias unload-lucy="sudo launchctl unload /Library/LaunchDaemons/com.oblomov.lucyServer.plist"
alias unload-reader="sudo launchctl unload /Library/LaunchDaemons/com.oblomov.readerServer.plist"
alias load-lucy="sudo launchctl load /Library/LaunchDaemons/com.oblomov.lucyServer.plist"
alias load-reader="sudo launchctl load /Library/LaunchDaemons/com.oblomov.readerServer.plist"
alias user-manager="~/git/Cercando/scripts/UserManager.sh"
