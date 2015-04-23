var Station = require('../../api/station/station.model');
var AudioBlock = require('../../api/audioBlock/audioBlock.model');
var LogEntry = require('../../api/logEntry/logEntry.model');
var Commentary = require('../../api/commentary/commentary.model');
var RotationItem = require('../../api/rotationItem/rotationItem.model');
var CommercialBlock = require('../../api/commercialBlock/commercialBlock.model');
var Song = require('../../api/song/song.model');
var Spin = require('../../api/spin/spin.model');
var User = require('../../api/user/user.model');
var moment = require('moment-timezone');
var _ = require('lodash');
var Helper = require('../helpers/helper');
var Q = require('q');



function Scheduler() {
  var self = this;

  function createSampleArray(station, callback) {
    var sampleArray = [];
    RotationItem.findAllForStation(station.id, function (err, rotationItems) {
      for (var i=0;i<rotationItems.length;i++) {
        if (rotationItems[i].bin === 'active') {
          for(var j=0;j<rotationItems[i].weight; j++) {
            sampleArray.push(rotationItems[i]._song);
          }
        }
      }
      callback(null, sampleArray);
    });
  }

  this.getFullSchedule = function (attrs, callback) {
    var schedule = [];
    var station = attrs.station;
    var startTime = attrs.startTime || (new Date() - 1000*60*60*24.5)   // default is 1 day + 30 min
      
    self.updateAirtimes({ station: station }, function (err, updatedStation) {
      // update local station
      self.station = updatedStation;

      // get all relevant past plays
      LogEntry.getLog({ _station: self.station._id,
                        startTime: startTime
                      }, function (err, logEntries) {
        // put in chronological order
        schedule = schedule.concat(logEntries);

        // now get the rest of the spins and 
        Spin.getFullPlaylist(self.station.id, function (err, spins) {
          // add the rest of the spins to the end of it
          schedule = schedule.concat(spins);

          // now that we have the schedule... send it through all
          callback(null, schedule);

        })
      })
    })
  }


  this.generatePlaylist = function (attrs, callback) {
    var previousSpin;
    var recentlyPlayedSongs = [];
    var spins = [];
    var sampleArray;

    // unpack attrs
    var station = attrs.station


    // return if playlistEndTime is out of range
    if (attrs.playlistEndTime && (moment().add(1,'days').isBefore(moment(attrs.playlistEndTime)))) {
      attrs.playlistEndTime = moment().add(1,'days').toDate();
    }

    // create the endTime
    var playlistEndTime = attrs.playlistEndTime || new Date(new Date().getTime() + 2*60*60*1000);

    // grab the playlist and logs
    LogEntry.getRecent({ _station: station.id,
                         count: 30 }, function (err, currentLogEntries) {

      Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {

        // ** preload the recentlyPlayed list ***
        
        // go backwards through currentPlaylist
        for (var i=currentPlaylist.length-1;i>=0;i--) {
          if (currentPlaylist[i]._type === 'Song') {
            recentlyPlayedSongs.push(currentPlaylist[i]);
          }
          // if there's enough, break out
          if (recentlyPlayedSongs >= 20) {
            break;
          }
        }

        // if needed, go through log entries too
        for (var i=0;i<currentLogEntries; i++) {
          if (recentlyPlayedSongs.length >= 20) {
            break;
          }
          if (currentLogEntries[i]._audioBlock._type === 'Song') {
            recentlyPlayedSongs.push(currentLogEntries[i]._audioBlock);
          }
        }

        // create the sampleArray
        createSampleArray(station, function (err, createdSampleArray) {
          sampleArray = createdSampleArray;
          // Set previousSpin
          // IF LOG exists
          if (currentLogEntries.length) {
            // IF log but no playlist
            if (!currentPlaylist.length) {
              previousSpin = { playlistPosition: currentLogEntries[0].playlistPosition,
                                        airtime: currentLogEntries[0].airtime,
                                        _audioBlock: currentLogEntries[0]._audioBlock,
                                        _station: station
                                      };
            } else { // (log and playlist exist) 
              previousSpin = currentPlaylist[currentPlaylist.length-1];
            }
          } else {  // (this is a new station)
            // create 1st spin and set it as the previous spin
            spins.push({ playlistPosition: 1,
                                  _audioBlock: chooseSong(),
                                  airtime: new Date(),
                                  _station: station,
                                  });
            previousSpin = spins[0];
          }

          // WHILE before playlistEndTime
          while (previousSpin.airtime < playlistEndTime) {
            // create the new spin
            var newSpin = { playlistPosition: previousSpin.playlistPosition + 1,
                            _audioBlock: chooseSong(),
                            _station: station,
                          };
            // add the airtime
            self.addScheduleTimeToSpin(station, previousSpin, newSpin);

            spins.push(newSpin);
            previousSpin = newSpin;
          
          } // ENDWHILE

          // Save the spins
          var spinsToSave = _.map(spins, function(spin) { return new Spin(spin); });
          Helper.saveAll(spinsToSave, function (err, savedSpins) {

            // update and save the station
            station.lastAccuratePlaylistPosition = previousSpin.playlistPosition;
            station.save(function (err, savedStation) {

              // if it's the first playlist, start the station
              if (currentLogEntries.length === 0) {
                var firstSpin = spins[0];
                var logEntry = new LogEntry({ _station: station.id,
                                              _audioBlock: firstSpin._audioBlock,
                                              playlistPosition: firstSpin.playlistPosition,
                                              airtime: firstSpin.airtime,
                                              durationOffset: firstSpin.durationOffset });
                logEntry.save(function (err, savedLogEntry) {
                  Spin.findByIdAndRemove(savedSpins[0].id, function (err, removedSpin) {
                    callback(null, station);
                    return;
                  });
                });
              // otherwise just go back
              } else {
                callback(null, station);
                return;
              }
            });
          });
        });
      });
    });

    // chooses a random song from the sampleArray
    function chooseSong() {
      var song = _.sample(sampleArray);

      // while the id is in the recentlyPlayedSongs array, pick another
      while(recentlyPlayedSongs.some(function (e) { return e.id === song.id; })) {
        song = _.sample(sampleArray);
      }

      // adjust recentlyPlayedSongs
      recentlyPlayedSongs.push(song);
      if (recentlyPlayedSongs.length >= 20) {
        recentlyPlayedSongs.shift();
      }

      return song;
    }
  }

  function checkForFollowingCommercial(startTimeMS, endTimeMS) {
    if ((Math.floor(startTimeMS/1800000.0) !== Math.floor(endTimeMS/1800000.0))) {
      return true;
    } else {
      return false;
    }
  }

  this.addScheduleTimeToSpin = function (station, previousSpin, spinToSchedule) {
    // account for unmarked spins
    var previousSpinMarkups = {
      duration: previousSpin.duration,
      boo: previousSpin._audioBlock.boo || previousSpin._audioBlock.duration,
      eoi: previousSpin._audioBlock.eoi || 0,
      eom: previousSpin._audioBlock.eom || (previousSpin._audioBlock.duration - 1000),  // subtract a second to mash em up
    }
    previousSpinMarkups.lengthOfOutro = previousSpinMarkups.eom - (previousSpinMarkups.boo);
    previousSpinMarkups.msAfterEoi = previousSpin._audioBlock.duration - (previousSpin._audioBlock.eom ||  1000);

    var spinToScheduleMarkups = {
      duration: spinToSchedule.duration,
      boo: spinToSchedule._audioBlock.boo || spinToSchedule._audioBlock.duration,
      eoi: spinToSchedule._audioBlock.eoi || 0,
      eom: spinToSchedule._audioBlock.eom || (spinToSchedule._audioBlock.duration - 1000),
    }
    spinToScheduleMarkups.lengthOfOutro = spinToScheduleMarkups.eom - (spinToScheduleMarkups.boo);
    spinToScheduleMarkups.msAfterEoi = spinToSchedule._audioBlock.duration - (spinToSchedule._audioBlock.eom ||  1000);

    var previousSpinAirtimeInMS = new Date(previousSpin.airtime).getTime();
    var commercialBlockLengthMS = (station.secsOfCommercialPerHour/2)*1000;

    // IF previousSpin had commercials
    if (previousSpin.commercialsFollow) {
      // eom + commercialTime
      previousSpin.durationOffset = previousSpinMarkups.eom - previousSpin._audioBlock.duration;
      spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.eom + commercialBlockLengthMS);
    // ELSE IF previousSpin=Commentary
    } else if (previousSpin._audioBlock._type === 'Commentary') {
      
      // previousSpin=Commentary, spinToSchedule=Song
      if (spinToSchedule._audioBlock._type === 'Song') {
        var msLeftOver = previousSpin._audioBlock.duration - (previousSpin.previousSpinOverlap || 1000);
        // IF previousSpin Commentary is long enough to cover intro
        if (msLeftOver >= spinToScheduleMarkups.eoi) {
          // subtract the intro length from the start time
          previousSpin.durationOffset = -(spinToScheduleMarkups.eoi);
          spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpin._audioBlock.duration - spinToScheduleMarkups.eoi);
        } else {
          // schedule it at the end of the overlap
          previousSpin.durationOffset = -msLeftOver;
          spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + (previousSpin.previousSpinOverlap || 0));
        }
      
      // ELSE IF previousSpin=Commentary && spinToSchedule=commentary
      } else if (spinToSchedule._audioBlock._type === 'Commentary') {
        // regular schedule
        previousSpin.durationOffset = 0;
        spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpin._audioBlock.duration);
        spinToSchedule.previousSpinOverlap = 0;
      }
    
    // ELSE IF previousSpin was a Song
    } else if (previousSpin._audioBlock._type === 'Song') {
      // IF previousSpin=song && spinToSchedule=Song
      if (spinToSchedule._audioBlock._type === 'Song') {
        // start at EOM
        spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.eom);
        previousSpin.durationOffset = previousSpinMarkups.eom - previousSpin._audioBlock.duration;
      // ELSE IF spinToSchedule=Commentary && previousSpin=Song
      } else if (spinToSchedule._audioBlock._type === 'Commentary') {
        // IF it's long enough to cover outro
        if (spinToSchedule._audioBlock.duration > previousSpinMarkups.lengthOfOutro) {
          // Subtract outro length
          previousSpin.durationOffset = previousSpinMarkups.lengthOfOutro;
          spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.boo);
          spinToSchedule.previousSpinOverlap = previousSpinMarkups.lengthOfOutro;
        // ELSE start new spin at previousSpin.eom
        } else {
          previousSpin.durationOffset = previousSpinMarkups.eom - previousSpin._audioBlock.duration;
          spinToSchedule.airtime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.eom);
          spinToSchedule.previousSpinOverlap = previousSpin._audioBlock.duration - previousSpinMarkups.eom;
        }
      }
    }

    // set previousSpin.manualEndTime
    if (previousSpin.commercialsFollow) {
      previousSpin.manualEndTime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.eom);
    } else {
      previousSpin.manualEndTime = spinToSchedule.airtime;
    }

    // add commercials to spinToSchedule if needed
    if (checkForFollowingCommercial(spinToSchedule.airtime.getTime(), spinToSchedule.airtime.getTime() + spinToScheduleMarkups.eom)) {
      spinToSchedule.commercialsFollow = true;
    }
  };



  this.updateAirtimes = function (attrs, callback) {

    var station = attrs.station;
    var previousSpin;
    var toBeUpdated = [];

    // exit if playlist is already accurate
    if ((attrs.playlistPosition) && (attrs.playlistPosition < station.lastAccuratePlaylistPosition)) {
      callback(null, station);
      return;
    }

    Spin.getFullPlaylist(station.id, function (err, gottenPlaylist) {
      var fullPlaylist = gottenPlaylist;
      
      // exit if there's no playlist
      if (!fullPlaylist.length) {
        callback(null, station);
        return;
      }

      // grab the last log entry, since it has to be accurate
      LogEntry.getRecent({ _station: station.id, count:1 }, function (err, gottenLogEntry) {
        
        // if the last log entry is the last Accurate Airtime, use it
        var finalLogEntry = gottenLogEntry[0];
        if (station.lastAccuratePlaylistPosition <= finalLogEntry.playlistPosition) {
          previousSpin = { _audioBlock: finalLogEntry._audioBlock,
                            airtime: finalLogEntry.airtime,
                            playlistPosition: finalLogEntry.playlistPosition,
                            _station: station,
                            commercialsFollow: finalLogEntry.commercialsFollow }
        
        // ELSE use the corresponding spin
        } else {

          // seek the last accurate spin
          var index;
          for(index=0;index<gottenPlaylist.length;index++) {
            if (gottenPlaylist[index].playlistPosition === station.lastAccuratePlaylistPosition) {
              break;
            }
          }
          
          // if it's last, exit (entire playlist is up to date)
          if (index === gottenPlaylist.length - 1){ 
            callback(null, station);
            return;
          }

          // set last accurate entry to previousSpin
          previousSpin = gottenPlaylist[index];

          // make sure it gets saved (since it's a spin)
          toBeUpdated.push(previousSpin);

          // set up gottenPlaylist to update
          gottenPlaylist = gottenPlaylist.slice(index + 1);
        }




        var lastAccurateAirtime;
        var lastAccuratePlaylistPosition;
        for(var i=0;i<gottenPlaylist.length;i++) {
          self.addScheduleTimeToSpin(station, previousSpin, gottenPlaylist[i]);
          toBeUpdated.push(gottenPlaylist[i]);

          // check for ending flags and exit if met
          if (attrs.endTime && (gottenPlaylist[i].airtime > attrs.endTime)) {
            break;
          }
          if (attrs.endingPlaylistPosition && (gottenPlaylist[i].playlistPosition >= attrs.endingPlaylistPosition)) {
            break;
          }

          // advance the previousSpin and station info
          lastAccuratePlaylistPosition = gottenPlaylist[i].playlistPosition;
          lastAccurateAirtime = gottenPlaylist[i].airtime;
          previousSpin = gottenPlaylist[i];
        }

        // update the station
        station.lastAccuratePlaylistPosition = lastAccuratePlaylistPosition;
        toBeUpdated.push(station);

        // update
        Helper.saveAll(toBeUpdated, function (err, savedPlaylist) {
          callback(null, station);
          return;
        });
      });
    });
  };

  this.bringCurrent = function (station, callback) {
    var logEntry;
    var playlist;
    var newLogEntries = [];

    // get last played logEntry
    LogEntry.getRecent({ _station: station.id, count: 1 }, function (err, logEntries) {
      
      // if there is no log or if the station is already current
      if (!logEntries.length || logEntries[0].endTime > new Date()) {
        callback(err, station);
        return;
      }
      
      logEntry = logEntries[0]

      // update airtimes through current time
      self.updateAirtimes({ station: station,
                            endTime: new Date() }, function (err, updatedStation) {
        station = updatedStation;
        
        // make sure the playlist lasts until now
        self.generatePlaylist({ station: station, endTime: Date.now() }, function (err, updatedStation) {
          station = updatedStation;

          // get the playlist
          Spin.getPartialPlaylist({ _station: station.id, 
                                    endTime: new Date()
                                     }, function (err, partialPlaylist) {

            playlist = partialPlaylist;

            // set up array for storing new entries to be saved
            var playedLogEntries = [];
            
            playlist.forEach(function (spin) {
              playedLogEntries.push(LogEntry.newFromSpin(spin));
            });

            Helper.saveAll(playedLogEntries, function (err, savedLogEntries) {
              Helper.removeAll(playlist, function (err, removedPlaylist) {
                callback(null);
                return null;
              });
            });
          });
        });
      });
    });
  }

  this.getProgram = function (attrs, callback) {
    Station.findById(attrs.stationId, function (err, station) {
      if (err) callback(err);
      if (!station) callback(new Error('Station not found'));

      // make sure schedule is accurate 2 hours from now
      self.updateAirtimes({ station: station,
                                    endTime: new Date(Date.now() + 60*60*2.5*1000) }, function (err, station) {
        self.bringCurrent(station, function () {
          self.generatePlaylist({ station: station,
                                      playlistEndTime: new Date(Date.now() + 60*60*2*1000) }, function (err, station) {
            Spin.getPartialPlaylist({ _station: station.id,
                                      endTime: new Date(Date.now() + 60*60*2*1000) }, function (err, playlist) {

              if(err) callback(err);
              LogEntry.getMostRecent(station.id, function (err, nowPlaying) {
                if (err) callback(err);

                // if a commercialBlock is in the playlist
                if (nowPlaying.commercialsFollow) {
                  
                  // create the new commercialBlock
                  var newCommercialBlock = {  _audioBlock: { 
                                                title: 'Commercial Block',
                                                _type: 'CommercialBlock',
                                                duration: station.secsOfCommercialPerHour/2*1000 
                                              },
                                              airtime: nowPlaying.endTime,
                                              endTime: playlist[0].airtime 
                                            };
                  
                  // if it's supposed to be nowPlaying insert it there
                  if (Date.now() > new Date(nowPlaying.endTime)) {
                    nowPlaying = newCommercialBlock;
                  
                  // if it's supposed to be first in the playlist
                  } else {
                    playlist.unshift(newCommercialBlock);
                  }
                }
                callback(null, {playlist: playlist, nowPlaying: nowPlaying, _station: station });
              });
            });
          });
        });
      });
    });
  }

  this.getCommercialBlockLink = function (attrs, callback) {
    User.findById(attrs._user, function (err, user) {
      if (err) return (err);
      
      // find CommercialBlockNumber 
      var commercialBlockNumber = Math.floor(new Date(attrs.airtime).getTime()/1800000.0);

      // IF there's no lastCommercial, set it as a blank object
      if (!user.lastCommercial) {
        user.lastCommercial = { audioFileId: 0 };
      }

      
      // IF it's already been adjusted for this block
      if (user.lastCommercial && user.lastCommercial.commercialBlockNumber && (user.lastCommercial.commercialBlockNumber === commercialBlockNumber)) {
        callback(null, user.lastCommercial.audioFileUrl);
        return;
      } else {
        var newLastCommercial = {};
        newLastCommercial.commercialBlockNumber = commercialBlockNumber;
        
        if (user.lastCommercial.audioFileId === 27) {
          newLastCommercial.audioFileId = 1;
          newLastCommercial.audioFileUrl = 'http://commercialblocks.playola.fm/0001_commercial_block.mp3';
        } else {
          newLastCommercial.audioFileId = user.lastCommercial.audioFileId + 1;
        }

        // build link
        newLastCommercial.audioFileUrl = "http://commercialblocks.playola.fm/" + pad(newLastCommercial.audioFileId, 4) + "_commercial_block.mp3";

        User.findByIdAndUpdate(user.id, { lastCommercial: newLastCommercial }, function (err, newUser) {
          if (err) callback(err);
          callback(null, newLastCommercial.audioFileUrl);
        });
      }
    })
    
    // taken from StackOverflow: http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
    function pad(n, width, z) {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }
  };

  // moves a spin
  this.moveSpin = function(attrs, callback) {
    Spin.findById(attrs.spinId, function (err, spin) {
      if (err) {
        callback(new Error('Spin not found'));
        return;
      }

      // throw an error if the same position is called for
      if (spin.playlistPosition === attrs.newPlaylistPosition) {
        callback (new Error('Spin is already at the requested playlistPosition'));
        return;
      }

      var minPlaylistPosition = Math.min(spin.playlistPosition, attrs.newPlaylistPosition);
      var maxPlaylistPosition = Math.max(spin.playlistPosition, attrs.newPlaylistPosition);

      var movingEarlier;
      if (minPlaylistPosition === attrs.newPlaylistPosition) {
        movingEarlier = true;
      }
      Spin.getFullPlaylist(spin._station, function (err, beforePlaylist) {
        if (err) callback(err);
      
        // find the relevant indexes
        var minIndex;
        var maxIndex;
        var oldIndex;
        var newIndex;

        for (var i=0;i<beforePlaylist.length;i++) {
          if (beforePlaylist[i].playlistPosition === minPlaylistPosition) {
            minIndex = i;
          } else if (beforePlaylist[i].playlistPosition === maxPlaylistPosition) {
            maxIndex = i;
            break;
          }
        }

        // if the requested playlistPosition is too early,
        if (minIndex === 0) {
          callback(new Error('Invalid newPlaylistPosition -- airs too soon'));
          return;

        // or too late
        } else if (attrs.newPlaylistPosition > beforePlaylist[beforePlaylist.length-1].playlistPosition) {
          callback(new Error('Invalid newPlaylistPosition -- after end of playlist'));
          return;
        }

        // rearrange the array
        if (movingEarlier) {
          beforePlaylist.splice(minIndex, 0, beforePlaylist.splice(maxIndex, 1)[0]);
        } else {
          beforePlaylist.splice(maxIndex, 0, beforePlaylist.splice(minIndex, 1)[0]);
        }

        // step through the array and replace playlistPositions
        var playlistPositionTracker = beforePlaylist[minIndex-1].playlistPosition + 1
        var spinsToSave = [];

        for (var i=minIndex; i<=maxIndex; i++) {
          beforePlaylist[i].playlistPosition = playlistPositionTracker;
          playlistPositionTracker++;
          spinsToSave.push(beforePlaylist[i]);
        }
        
        Helper.saveAll(spinsToSave, function (err, updatedSpins) {  
          Station.findByIdAndUpdate(spin._station, { lastAccuratePlaylistPosition: minPlaylistPosition - 1 
                                                          }, function (err, updatedStation) {
            if (err) callback(err);
            self.updateAirtimes({ station: updatedStation, playlistPosition: maxPlaylistPosition + 1 }, function (err, updatedStation) {
              callback(null, { station: updatedStation,
                              updatedSpins: updatedSpins });
            });
          });
        });
      });
    });
  }

  this.removeSpin = function (spin, callback) {
    Spin.getPartialPlaylist({ startingPlaylistPosition: spin.playlistPosition + 1,
                              _station: spin._station
                            }, function (err, beforePlaylist) {
      if (err) return (err);

      var modelsToSave = [];
      var playlistPositionTracker = spin.playlistPosition + 1;
      for(var i=0; i<beforePlaylist.length;i++) {
        beforePlaylist[i].playlistPosition = beforePlaylist[i].playlistPosition - 1;
        modelsToSave.push(beforePlaylist[i]);
      }
      Station.findById(spin._station, function (err, station) {
        if (err) return (err);
        
        station.lastAccuratePlaylistPosition = spin.playlistPosition - 1;
        modelsToSave.push(station);

        Helper.saveAll(modelsToSave, function (err, savedSpins) {
          if (err) return (err);

          Spin.findByIdAndRemove(spin._id, function (err, removedSpin) {

            self.updateAirtimes({ station: station, playlistPosition: modelsToSave[0].playlistPosition 
                                }, function (err, updatedStation) {
              if (err) return err;

              callback(null, updatedStation);
            });
          });
        });
      });
    });
  };

  this.insertSpin = function (spinInfo, callback) {
    Spin.getPartialPlaylist({ startingPlaylistPosition: spinInfo.playlistPosition,
                              _station: spinInfo._station }, function (err, partialPlaylist) {
      if (err) callback(err);
    
      // update the rest of the playlist
      var modelsToSave = [];

      var playlistPositionTracker = partialPlaylist[0].playlistPosition + 1;

      for (var i=0;i<partialPlaylist.length;i++) {
        partialPlaylist[i].playlistPosition = playlistPositionTracker;
        modelsToSave.push(partialPlaylist[i]);
        playlistPositionTracker++;
      }

      // create the new spin
      var newSpin = new Spin({ _station: spinInfo._station,
                              _audioBlock: spinInfo._audioBlock,
                              playlistPosition: spinInfo.playlistPosition,
                              airtime: partialPlaylist[0].airtime });
      modelsToSave.push(newSpin);

      Station.findByIdAndUpdate(spinInfo._station, { lastAccuratePlaylistPosition: newSpin.playlistPosition - 1
                                                   }, function (err, updatedStation) {
        Helper.saveAll(modelsToSave, function (err, savedModels) {
          if (err) return err;
          callback(null, updatedStation);
        });
      });
    });
  };
}


module.exports = new Scheduler();