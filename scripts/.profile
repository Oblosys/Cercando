export PATH=.:~/git/Cercando/scripts:$PATH
export PS1='\[\033[1;36m\]Lucy:\w> \[\033[0m\]'
export EDITOR=emacs

export HISTCONTROL=ignoredups
# arrow keys select in history
bind '"[A":history-search-backward'
bind '"[B":history-search-forward'

alias ls="ls -al"
alias lss="/bin/ls"

alias cerc="cd git/Cercando"
