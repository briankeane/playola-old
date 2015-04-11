rm -rf plnodeTestVagrant/node_modules

sudo apt-get update
sudo apt-get install -y git
sudo apt-get install python-software-properties python g++ make

sudo apt-get update

sudo apt-get install -y libtag1-dev
sudo apt-get install -y libav-tools
sudo apt-get install -y libmp3lame-dev
sudo apt-get update
sudo apt-get -y --force-yes install autoconf automake build-essential libass-dev libfreetype6-dev libgpac-dev libsdl1.2-dev libtheora-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev pkg-config texi2html zlib1g-dev
mkdir ~/ffmpeg_sources

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10

echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
sudo apt-get update

sudo apt-get install -y mongodb-org
sudo mkdir -p /data/db