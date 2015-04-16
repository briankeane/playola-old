# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure(2) do |config|

  config.vm.box = "ubuntu/trusty64"

  config.vm.network "forwarded_port", guest: 9000, host: 9000, auto_correct: true
  config.vm.network "forwarded_port", guest: 5858, host: 5858, auto_correct: true
  config.vm.network "forwarded_port", guest: 8080, host: 8080, auto_correct: true
  config.vm.network "forwarded_port", guest: 27017, host: 27170, auto_correct: true
  config.vm.network "forwarded_port", guest: 35729, host: 35729

  config.vm.network "forwarded_port", guest: 3501, host: 3510, auto_correct: true   # yeoman server port

  config.ssh.forward_agent = true

  config.vm.network :public_network, bridge: "en0: Wi-Fi (AirPort)"
  config.vm.network "private_network", type: "dhcp"

  config.vm.synced_folder ".", "/home/vagrant/www", create: true, type: "nfs"
  config.vm.synced_folder "../dist", "/home/vagrant/dist", create: true, type: "nfs"

  config.vm.provider "virtualbox" do |vb|
    vb.customize ["setextradata", :id, "VBoxInternal2/SharedFoldersEnableSymlinksCreate/v-root","1"]

    # increase memory size to 1/4 of available
    host = RbConfig::CONFIG['host_os']

    # Give VM 1/4 system memory & access to all cpu cores on the host
    if host =~ /darwin/
      cpus = `sysctl -n hw.ncpu`.to_i
      # sysctl returns Bytes and we need to convert to MB
      mem = `sysctl -n hw.memsize`.to_i / 1024 / 1024 / 4
    elsif host =~ /linux/
      cpus = `nproc`.to_i
      # meminfo shows KB and we need to convert to MB
      mem = `grep 'MemTotal' /proc/meminfo | sed -e 's/MemTotal://' -e 's/ kB//'`.to_i / 1024 / 4
    else # sorry Windows folks, I can't help you
      cpus = 2
      mem = 1024
    end

    vb.customize ["modifyvm", :id, "--memory", mem]
    vb.customize ["modifyvm", :id, "--cpus", cpus]
  end

  # Removes "stdin: is not a tty" annoyance as per
  # https://github.com/SocialGeeks/vagrant-openstack/commit/d3ea0695e64ea2e905a67c1b7e12d794a1a29b97
  config.ssh.shell = "bash -c 'BASH_ENV=/etc/profile exec bash'"

  config.vm.provision :shell, path: "vagrant/increaseSwap.sh"
  config.vm.provision :shell, path: "vagrant/rootScript.sh"
  config.vm.provision :shell, privileged: false, path: "vagrant/userScript.sh" 
end

