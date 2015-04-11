cd www

# # Installing nvm
wget -qO- https://raw.github.com/creationix/nvm/master/install.sh | sh

# # This enables NVM without a logout/login
export NVM_DIR="/home/vagrant/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

# Install a node and alias
nvm install 0.10.33
nvm alias default 0.10.33

# doesn't take
nvm use 0.10.33
npm install -g npm@latest
npm install -g bower grunt-cli
npm install -g yo
npm install
bower install
