'use strict';

angular.module('playolaApp')
  .service('AudioPlayer', function ($rootScope, $interval, $timeout, Auth) {

    // initialize variables
    var self = this;
    self.currentUser = Auth.getCurrentUser();
    self.muted = false;
    self.volumeLevel = 1;
    self.musicStarted = false;
    self.audioQueue = [];
    self.nowPlaying;
    self.playlist;
    self.requests = [];
    self.volume = 1;
    self.timeouts = [];
    self.isLoading = true;
    self.initialLoad = true;
    self.stationPlayingId;
    self.isPlaying = false;
    self.compressor;
    self.stationPlaying;
    self.requests = [];

    // set up audio context and audio nodes
    if (!self.context) {
      if ('webkitAudioContext' in window) {
        self.context = new webkitAudioContext;
      } else {
        self.context = new AudioContext();
      }
    }

    // Create a compressor node
    self.compressor = self.context.createDynamicsCompressor();
    self.compressor.threshold.value = -10;
    self.compressor.knee.value = 20;
    self.compressor.ratio.value = 6;
    self.compressor.reduction.value = -10;
    self.compressor.attack.value = 0;
    self.compressor.release.value = 0.25;

    // connect context/gain/muteGain/destination into chain
    self.gainNode = this.context.createGain();
    self.muteGain = this.context.createGain();
    self.compressor.connect(self.gainNode);
    self.gainNode.connect(self.muteGain);
    self.muteGain.connect(this.context.destination);

    $rootScope.$on('loggedOut', function () {
      self.clearPlayer();
      cancelTimeouts();
      self.isPlaying = false;
      self.isLoading = false;
      self.intialLoad = true;
    });

    // *************************************************
    // *         loadStation(stationId)                *
    // *************************************************
    // * takes an attrs object with listenStationId,   *
    // *   & audioQueue.  Clears out the old info and  *
    // *   loads the new info                          *
    // ************************************************* 
    this.loadStation = function (stationId) {
      
      // if the station is already playing the one requested, do nothing
      if (self.isPlaying && (self.stationPlayingId === stationId)) {
        return;
      }

      self.clearPlayer();

      self.isLoading = true;
      self.isPlaying = false;

      self.stationPlayingId = stationId;
      $rootScope.$broadcast('stationChanged');

      // if it's the initial load, set up listeningSession reporting
      if (self.initialLoad) {
        self.initialLoad = false;
        createListeningSession();
      }

      Auth.getProgram({ id: stationId }, function (err, program) {
        if (err) console.log(err);

        self.nowPlaying = program.nowPlaying;
        self.playlist = [program.playlist[0]];
        self.stationPlaying = program._station;

        loadAudio([self.nowPlaying], function (err) {
          if (err) console.log(err);

          // if it took to long to load the first song, start load process over
          if (self.nowPlaying.endTime && (Date.now() < self.nowPlaying.endTime)) {
            self.loadStation(stationId);
            return;
          }

          // start music, load next songs.
          var secsAlreadyElapsed = (Date.now() - new Date(self.nowPlaying.airtime).getTime())/1000;
          self.nowPlaying.source.start(0, secsAlreadyElapsed);

          self.isPlaying = true;

          // fade out at end of song
          var eomSecs = (self.nowPlaying._audioBlock.eom + 1000 || self.nowPlaying._audioBlock.duration - 1000)/1000;
          self.nowPlaying.gainNode.gain.exponentialRampToValueAtTime(1, self.context.currentTime - secsAlreadyElapsed + eomSecs);
          self.nowPlaying.gainNode.gain.exponentialRampToValueAtTime(0.01, self.context.currentTime - secsAlreadyElapsed + eomSecs + 5);

          self.isLoading = false;

          refreshProgram();

          // set next advance
          var newTimeout = $timeout(function () {
            advanceSpin();
            return false;
          }, new Date(self.nowPlaying.endTime) - Date.now());

          self.timeouts.push(newTimeout);
        });
      });
    };

    this.setVolume = function (volume) {
      self.volume = volume;
      if (!self.muted) {
        self.gainNode.gain.value = self.volume;
      }
    }

    this.mute = function () {
      self.muteGain.gain.exponentialRampToValueAtTime(self.muteGain.gain.value, self.context.currentTime);
      self.muteGain.gain.exponentialRampToValueAtTime(0.000001, self.context.currentTime + 0.5);
      self.muted = true;
    }

    this.unmute = function () {
      self.muteGain.gain.exponentialRampToValueAtTime(self.muteGain.gain.value, self.context.currentTime);
      self.muteGain.gain.exponentialRampToValueAtTime(1, self.context.currentTime + 0.5);
      self.muted = false;
    }
    
    this.clearPlayer = function () {
      // stop the source if it's playing
      if (self.nowPlaying && self.nowPlaying.source) {
        self.nowPlaying.source.stop();
      }

      cancelTimeouts();
      
      // clear the queues
      self.nowPlaying = null;
      self.playlist = null;
    };

    function advanceSpin() {
      self.nowPlaying = self.playlist.shift();
      $rootScope.$broadcast('spinAdvanced');

      // play next song now or when it's done loading
      if (self.nowPlaying && self.nowPlaying.source) {
        self.nowPlaying.source.start(0);

        // fade out at end of song -- ensures songs with long outros don't overlap
        var eom = (self.nowPlaying._audioBlock.eom + 1000 || self.nowPlaying._audioBlock.duration + 1000)/1000;
        self.nowPlaying.gainNode.gain.exponentialRampToValueAtTime(1, self.context.currentTime + eom); // start fading out 2 secs before
        self.nowPlaying.gainNode.gain.exponentialRampToValueAtTime(0.01, self.context.currentTime + eom + 5); // end fade out 1 sec after
      }
      
      // wait and grab the program
      $timeout(function () {
        refreshProgram();
      }, 2000);

      // set up the next advance
      var newTimeout = $timeout(function () {
        advanceSpin();
      }, new Date(self.nowPlaying.endTime).getTime() - Date.now());

      // store it in a list so it can be cancelled
      self.timeouts.push(newTimeout);
    }

    function refreshProgram() {
      Auth.getProgram({  id: self.stationPlayingId }, function (err, program) {
        $rootScope.$broadcast('programRefreshed', program);

        if (err) console.log(err);

        // add at least 3 min of song
        var totalMS = 0;
        for(var i=0;i<program.playlist.length;i++) {
          // if it's already been added, just count the MS
          if (self.playlist[i]) {
            totalMS += self.playlist[i].duration;

            // if times need to be updated, update them
            if (self.playlist[i].airtime != program.playlist[i].airtime) {
              self.playlist[i].airtime = program.playlist[i].airtime;
            }

            if (self.playlist[i].endTime != program.playlist[i].airtime) {
              self.playlist[i].endTime = program.playlist[i].endTime;
            }

          // otherwise, add it to the list
          } else {
            self.playlist.push(program.playlist[i]);
            totalMS += self.playlist[i].duration;
          }
          if (totalMS >= 180000) {
            break;
          }
        }
        loadAudio(self.playlist);
      });
    }

    function createListeningSession() {
      Auth.createListeningSession({ _station: self.stationPlayingId,
                                    _user: self.currentUser.id 
                                  }, function (err, listeningSession) {
        self.listeningSessionId = listeningSession._id;
        
        // start updating in 1 minute
        $timeout(function () {
          updateListeningSession();
        }, 60*1000)
      });
    }

    function cancelTimeouts() {
      // stop any advances
      for(var i=0;i<self.timeouts.length;i++) {
        $timeout.cancel(self.timeouts[i]);
      }
      self.timeouts = [];
    }

    function updateListeningSession() {
      Auth.updateListeningSession({ id: self.listeningSessionId,
                                    _station: self.stationPlayingId 
                                  }, function (err, listeningSession) {
        if (listeningSession) {
          self.listeningSessionId = listeningSession._id;
        }
      });
      
      // update again in 60 secs
      $timeout(updateListeningSession, 60*1000);
    }

    // loadAudio only works for 1 element arrays right now
    function loadAudio(spins, callback) {
      var cb = callback || angular.noop;
      var context = self.context;
      

      // load each element
      for (var i=0;i<spins.length;i++) {
        // if it hasn't been done already... 
        var spin = spins[i];

        if (!spin.source) {
          spin.request = new XMLHttpRequest();
          spin.request.open('GET', spin._audioBlock.audioFileUrl, true);
          spin.request.responseType = 'arraybuffer';

          // decode
          (function (spin) {
            spin.request.onload = function () {
              context.decodeAudioData(spin.request.response, function (buffer) {
                var source = context.createBufferSource();
                source.buffer = buffer;
                
                spin.gainNode = context.createGain();
                source.connect(spin.gainNode);
                spin.gainNode.connect(self.gainNode);
                spin.source = source;
                cb();
              });
            };
          })(spin);
        spin.request.send();
        }
      }
    }
  });

