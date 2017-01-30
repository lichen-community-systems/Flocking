# -*- mode: ruby -*-
# vi: set ft=ruby :

require 'yaml'

ansible_vars = YAML.load_file("provisioning/vars.yml")

app_name = ansible_vars["nodejs_app_name"]

app_directory = ansible_vars["nodejs_app_install_dir"]

app_start_script = ansible_vars["nodejs_app_start_script"]

# Check for the existence of the 'VM_HOST_TCP_PORT' environment variable. If it
# doesn't exist and 'nodejs_app_tcp_port' is defined in vars.yml then use that
# port. Failing that use defaults provided in this file.
host_tcp_port = ENV["VM_HOST_TCP_PORT"] || ansible_vars["nodejs_app_tcp_port"] || 8081
guest_tcp_port = ansible_vars["nodejs_app_tcp_port"] || 8081

# By default this VM will use 2 processor cores and 2GB of RAM. The 'VM_CPUS' and
# "VM_RAM" environment variables can be used to change that behaviour.
cpus = ENV["VM_CPUS"] || 2
ram = ENV["VM_RAM"] || 2048

Vagrant.configure(2) do |config|

  config.vm.box = "inclusivedesign/fedora24"

  # Your working directory will be synced to /home/vagrant/sync in the VM.
  config.vm.synced_folder ".", "#{app_directory}"

  # List additional directories to sync to the VM in your "Vagrantfile.local" file
  # using the following format:
  # config.vm.synced_folder "../path/on/your/host/os/your-project", "/home/vagrant/sync/your-project"

  if File.exist? "Vagrantfile.local"
    instance_eval File.read("Vagrantfile.local"), "Vagrantfile.local"
  end

  # Port forwarding takes place here. The 'guest' port is used inside the VM
  # whereas the 'host' port is used by your host operating system.
  config.vm.network "forwarded_port", guest: guest_tcp_port, host: host_tcp_port, protocol: "tcp",
    auto_correct: true

  # Port 19531 is needed so logs can be viewed using systemd-journal-gateway
  #config.vm.network "forwarded_port", guest: 19531, host: 19531, protocol: "tcp",
  #  auto_correct: true

  config.vm.hostname = app_name

  config.vm.provider :virtualbox do |vm|
    vm.customize ["modifyvm", :id, "--memory", ram]
    vm.customize ["modifyvm", :id, "--cpus", cpus]
    vm.customize ["modifyvm", :id, "--vram", "256"]
    vm.customize ["modifyvm", :id, "--accelerate3d", "off"]
    vm.customize ["modifyvm", :id, "--audio", "null", "--audiocontroller", "ac97"]
    vm.customize ["modifyvm", :id, "--ioapic", "on"]
    vm.customize ["setextradata", "global", "GUI/SuppressMessages", "all"]
  end

  config.vm.provision "shell", inline: <<-SHELL
    sudo dnf -y upgrade firefox google-chrome-stable
    sudo ansible-galaxy install -fr /home/vagrant/sync/provisioning/requirements.yml
    sudo PYTHONUNBUFFERED=1 ansible-playbook /home/vagrant/sync/provisioning/playbook.yml --tags="install,configure"
  SHELL

  # Using config.vm.hostname to set the hostname on Fedora VMs seems to remove the string
  # "localhost" from the first line of /etc/hosts. This script reinserts it if it's missing.
  # https://github.com/mitchellh/vagrant/pull/6203
  config.vm.provision "shell",
    inline: "/usr/local/bin/edit-hosts.sh",
    run: "always"

end
