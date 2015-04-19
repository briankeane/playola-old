# plNode

---------------------------
## Installation

To install playola in a local dev environment:


1. Download and Install [Vagrant](https://www.vagrantup.com/downloads.html)
2. Clone this repo:  `git clone https://github.com/briankeane/plnode.git`
3. Email me (brian at briankeane.net) for a local.env.js file and put it in the server/config
4. type `vagrant up` (this will take a while... 30-45min+.  There is 1 prompt early on for system Password... Soon after it will ask you where to bridge the internet connection.  From there on out it will run by itself)
5. type `vagrant ssh` to get into the new local virtual machine
6. from inside your new vm, seed the db with these commands:  `cd www`, `NODE_ENV=development grunt loadDB:dev    // this will also take a few minutes`
7. type `grunt serve`, wait several seconds for it to load, and navigate your browser to 'localhost:9000'

That's it!  Thanks for the help.