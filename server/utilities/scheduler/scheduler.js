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
var Rules = require('../rules/rules');



function Scheduler() {
  var self = this;

  // ******************************************************************************
  // ****************************** getFullSchedule *******************************
  // ******************************************************************************
  // * DESCRIPTION: Combines the full schedule from LogEntries and Spins...       *
  // * ARGUMENTS: attrs.station, attrs.startTime (optional)                       *
  // ******************************************************************************
  this.getFullSchedule = function (attrs, callback) {
    var schedule = [];
    var station = attrs.station;
    var startTime = attrs.startTime || (new Date() - 1000*60*60*24.5)   // default is 1 day + 30 min

    // gather the needed info
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
          // add the rest of the spins to the end of the schedule
          schedule = schedule.concat(spins);

          // now that we have the schedule... send it through
          callback(null, schedule);
        });
      });
    });
  }

  // ******************************************************************************
  // ******************************** chooseSong **********************************
  // ******************************************************************************
  // * DESCRIPTION: Chooses a song that does not break any assigned rules         *
  // * ARGUMENTS: attrs.station                                                   *
  // *            attrs.airtime -- (approximate)                                  *
  // *            attrs.fullSchedule -- an array of all relevant scheduled songs  *
  // *            attrs.rotationItems -- an array of the choices                  *
  // ******************************************************************************
  this.chooseSong = function (attrs) {
    var warnings = [];
    
    var previousPossibleSongs = attrs.songlist;
    
    // send through the filters

    // SONG REST
    if (attrs.station.rules.songMinimumRest) {
      var newSonglist = Rules.songMinimumRest({ airtime: attrs.airtime,
                                                schedule: attrs.fullSchedule,
                                                songlist: previousPossibleSongs,
                                                minutesOfRest: attrs.station.rules.songMinimumRest.minutesOfRest
                                              });
      if (newSonglist.length) {
        previousPossibleSongs = newSonglist;
      } else {
        warnings.push({ message: 'songMinimumRest violated -- would have eliminated all choices' });
      }
    }

    // ARTIST REST
    if (attrs.station.rules.artistMinimumRest) {

      var newSonglist = Rules.artistMinimumRest({ airtime: attrs.airtime,
                                                  schedule: attrs.fullSchedule,
                                                  songlist: previousPossibleSongs,
                                                  minutesOfRest: attrs.station.rules.artistMinimumRest.minutesOfRest
                                                });

      if (newSonglist.length) {
        previousPossibleSongs = newSonglist;
      } else {
        warnings.push({ message: 'artistMinimumRest violated -- would have eliminated all choices' });
      }
    }

    // DAY OFFSET FILTER
    if (attrs.station.rules.dayOffset) {
      var newSonglist = Rules.dayOffset({ airtime: attrs.airtime,
                                          schedule: attrs.fullSchedule,
                                          songlist: previousPossibleSongs,
                                          windowSizeMinutes: attrs.station.rules.dayOffset.windowSizeMinutes
                                          });
      if (newSonglist.length) {
        previousPossibleSongs = newSonglist;
      } else {
        warnings.push({ message: 'dayOffset violated -- would have eliminated all choices' });
      }
    }

    // randomly pick song from what's left
    var song = _.sample(previousPossibleSongs);

    return { song: song,
            warnings: warnings };
  };

  this.generatePlaylist = function (attrs, callback) {
    var warnings = [];
    var station = attrs.station;
    var previousSpin;
    var rotationItems;
    var newStationFlag = false;

    // adjust playlistEndTime if it's out of max range
    if (attrs.playlistEndTime && (moment().add(1,'days').isBefore(moment(attrs.playlistEndTime)))) {
      attrs.playlistEndTime = moment().add(1,'days').toDate();
    }

    // create the endTime
    var playlistEndTime = attrs.playlistEndTime || new Date(new Date().getTime() + 3*60*60*1000);

    // grab the rotationItems
    RotationItem.findAllForStation(station.id, function (err, rotationItems) {

      // set up bins object
      var bins = {};
      for (var i=0;i<rotationItems.length;i++) {
        // if the bin doesn't exist yet, create it
        if (!bins[rotationItems[i].bin]) {
          bins[rotationItems[i].bin] = [];
        }
        // add the song to the bin
        bins[rotationItems[i].bin].push(rotationItems[i]._song);
      }

      // grab everything that has been scheduled
      self.getFullSchedule({ station: attrs.station }, function (err, fullSchedule) {
          
        var firstNewPlaylistIndex;  // so we know which spins to save later on

        // if this is a brand new station, schedule the first song. Also set previousSpin
        if (!fullSchedule.length) {
          newStationFlag = true;
          fullSchedule = [];
          fullSchedule.push({ playlistPosition: 1,
                        _audioBlock: rotationItems[0]._song, 
                        _station: station,
                        airtime: new Date(Date.now()),
                        station: station
                      });
          previousSpin = fullSchedule[0];
          firstNewPlaylistIndex = 0;
        } else {

          previousSpin = fullSchedule[fullSchedule.length-1];
          firstNewPlaylistIndex = fullSchedule.length;
        }

        // declare variables for clock
        var clock;
        var clockStartTime;
        var nextSyncTime;
        var nextSyncClockIndex;
        var nextSyncIndex;
        var clockEndTime;
        var clockIndex = 0;

        // WHILE before playlistEndTime
        while(previousSpin.airtime < playlistEndTime) {

          // get approx airtime for calculations
          var nextAirtime = new Date(previousSpin.airtime + previousSpin._audioBlock.duration);

          // if there's no clock, set one up
          if (!clock) {
            clock = station.getClock(nextAirtime);

            // This convoluted way of setting time is a workaround for timekeeper tests
            clockStartTime = new Date().getTime();
            clockStartTime = new Date(clockStartTime);
            clockStartTime.setMinutes(0,0,0);      // set to the previous top of the hour
            
            // set clockIndex (move 1 index for every 3 minutes);
            clockIndex = Math.floor(((new Date().getTime() - clockStartTime.getTime())/1000)/(60*3));
            
            // set clockEndTime
            clockEndTime = new Date(clockStartTime.getTime() + clock.end*1000);

            // set nextSyncTime 
            if (clock.syncs.length) {
              for (var i=0;i<clock.syncs;i++) {
                if (syncs[i].index > clockIndex) {
                  nextSyncTime = new Date(clockStartTime + syncs[i].secs*1000);
                  nextSyncIndex = i;
                  nextSyncClockIndex = syncs[i].index;
                }
              }
            } else {
              nextSyncTime = null;
            }

          }  // ENDIF clock-setup
          var currentSonglist = bins[clock.items[clockIndex].bin];
          // Before attempting to grab a song, make sure the bin exists and has songs
          while (!currentSonglist) {
            warnings.push({ message: clock.items[clockIndex] + ' bin was empty...' });
            clockIndex++;
            if (clockIndex >= clock.items.length) {
              // for now, randomly select a bin
              var keys = Object.keys(bins)
              currentSonglist = bins[keys[keys.length * Math.random() << 0]];
              warnings.push({ message: 'clock did not fill time' });

            } else {
              currentSonglist = clock.items[clockIndex];
            }
          }

          // grab the next song
          var result = self.chooseSong({ airtime: nextAirtime,
                                          station: station,
                                          songlist: currentSonglist,
                                          fullSchedule: fullSchedule
                                        });
          var newSong = result.song;

          // grab any warnings if they existed
          warnings = warnings.concat(result.warnings);
          var newSpin = { playlistPosition: previousSpin.playlistPosition + 1,
                          _audioBlock: newSong,
                          _station: station };
          
          // adjust airtimes
          self.addScheduleTimeToSpin(station, previousSpin, newSpin);

          fullSchedule.push(newSpin);
          clockIndex += 1;

          // if it's the end of the clock
          if ((clockIndex >= clock.items.length) || ((newSpin.airtime + newSpin.duration) > clock.endTime)) {
            clockIndex = null;
            clock = null;
            clockStartTime = null;
            clockEndTime = null;
          
          // ELSE IF sync needs to be advanced
          } else if (((newSpin.airtime + newSpin.duration) >  nextSyncTime) &&
                  (clockIndex < nextSyncClockIndex)) {

              clockIndex = nextSyncClockIndex;
              nextSyncIndex += 1;

              if (nextSyncIndex >= clock.syncs.length) {
                nextSyncTime = null;
              } else {
                nextSyncTime = new Date(clockStartTime + syncs[nextSyncIndex].secs*1000);
                nextSyncClockIndex = syncs[nextSyncIndex].index;
              }
            }

            previousSpin = newSpin;
          } // ENDWHILE

        // grab the spins that need to be saved
        var spinsToSave = _.map(fullSchedule.slice(firstNewPlaylistIndex), function(spin) { return new Spin(spin); });

        Helper.saveAll(spinsToSave, function (err, savedSpins) {
          // if the station is new, start it
          if (newStationFlag) {
            var logEntry = LogEntry.newFromSpin(savedSpins[0]);
            logEntry.save(function (err, savedLogEntry) {
              savedSpins[0].remove(function (err, removedSpin) {
                callback (null, { warnings: warnings });
              });
            });
          } else {
            callback(null, { warnings: warnings });
          }
        });
      });
    });
  };

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

    // set previousSpin._endTime
    if (previousSpin.commercialsFollow) {
      previousSpin._endTime = new Date(previousSpinAirtimeInMS + previousSpinMarkups.eom);
    } else {
      previousSpin._endTime = spinToSchedule.airtime;
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

if (!station) { 
  console.log('notStation.id!');
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

        previousSpin = { _audioBlock: finalLogEntry._audioBlock,
                          airtime: finalLogEntry.airtime,
                          playlistPosition: finalLogEntry.playlistPosition,
                          _station: station,
                          commercialsFollow: finalLogEntry.commercialsFollow }
        
        var playlistPositionTracker = finalLogEntry.playlistPosition + 1;
        for(var i=0;i<gottenPlaylist.length;i++) {
          self.addScheduleTimeToSpin(station, previousSpin, gottenPlaylist[i]);
          
          // store and increment playlistPosition
          gottenPlaylist[i].playlistPosition = playlistPositionTracker;
          playlistPositionTracker++;

          toBeUpdated.push(gottenPlaylist[i]);

          // check for ending flags and exit if met
          if (attrs.endTime && (gottenPlaylist[i].airtime > attrs.endTime)) {
            break;
          }
          if (attrs.endingPlaylistPosition && (gottenPlaylist[i].playlistPosition >= attrs.endingPlaylistPosition)) {
            break;
          }

          // advance the previousSpin
          previousSpin = gottenPlaylist[i];
        }

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

        // make sure the playlist lasts until now
        self.generatePlaylist({ station: station, endTime: Date.now() }, function (err, result) {

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
    Station.findById(attrs.stationId)
    .populate('_user')
    .exec(function (err, station) {
      if (err) callback(err);
      if (!station) callback(new Error('Station not found'));

      // make sure schedule is accurate 3 hours from now
      self.updateAirtimes({ station: station,
                                    endTime: new Date(Date.now() + 60*60*3*1000) }, function (err, station) {
        self.bringCurrent(station, function () {
          self.generatePlaylist({ station: station,
                                      playlistEndTime: new Date(Date.now() + 60*60*3*1000) }, function (err, result) {

            Spin.getPartialPlaylist({ _station: station.id,
                                      endTime: new Date(Date.now() + 60*60*3*1000) }, function (err, playlist) {

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
    var user = attrs.user

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
    
    // taken from StackOverflow: http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
    function pad(n, width, z) {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }
    
  };

  // moves a spin
  this.moveSpin = function(attrs, callback) {
    Spin.findById(attrs.spinId)
    .populate('_station')
    .exec(function (err, spin) {

      var station = spin._station;

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
          if (err) callback(err);
          self.updateAirtimes({ station: station, playlistPosition: maxPlaylistPosition + 1 }, function (err, updatedStation) {
            callback(null, { updatedSpins: updatedSpins, station: station });
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
        beforePlaylist[i].playlistPosition = playlistPositionTracker;
        modelsToSave.push(beforePlaylist[i]);
        playlistPositionTracker++;
      }
      Station.findById(spin._station, function (err, station) {
        if (err) return (err);
        
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

      Helper.saveAll(modelsToSave, function (err, savedModels) {
        if (err) return err;
        callback(null, { updateSpins: savedModels });
      });
    });
  };
}


module.exports = new Scheduler();