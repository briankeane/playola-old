'use strict';

var ListeningSession = require('../listeningSession/listeningSession.model');
var User = require('../user/user.model');
var Helper = require('../../utilities/helpers/helper');
var timestamps = require('mongoose-timestamp');
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var Q = require('q');

var defaultRules = { 
                     artistMinimumRest: { minutesOfRest: 70 },
                     songMinimumRest: { minutesOfRest: 180 },
                     dayOffset: { windowSizeMinutes: 60 }
                   }


var StationSchema = new Schema({
  _user:                                  { type: Schema.ObjectId, ref: 'User'},
  secsOfCommercialPerHour:                { type: Number, default: 360        },
  lastAccuratePlaylistPosition:           { type: Number                      },
  dailyListenTimeMS:                      { type: Number, default: 0          },
  timezone:                               { type: String                      },
  commentaryCounter:                      { type: Number, default: 0          },
  dailyListenTimeCalculationDate:         { type: Date, default: Date.now()   },
  clocks:                                 {},
  rules:                                  { type: {}, default: defaultRules   }
});

StationSchema.methods.getClock = function (airtime) {
  // for now, everyone will be on the same damn clock
  return { items: [ 
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'light'  },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'light'  },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'light'  },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'light'  },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'light'  },
                   { type: 'bin',  bin: 'heavy'  },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'medium' },
                   { type: 'bin',  bin: 'light'  }
                  ],
            syncs: [ { secs: 30*60, index: 11 } ],
            end: 60*60
          }
};

// lists Stations by dailyListenTimeMS.  Calculates dailyListenTimeMS if it has not been updated yet today
StationSchema.statics.listByRank = function (attrs, callback) {
  Station.find({}, function (err, fullList) {
    var lastNightMidnightMs = new Date().setHours(0,0,0,0);
    var  getRankFunctions = [];

    
    for(var i=0;i<fullList.length;i++) {
      getRankFunctions.push((function(index) {

        // IF it was calculated today, just use what's there
        var deferred = Q.defer();
        if (fullList[index].dailyListenTimeCalculationDate < lastNightMidnightMs) {
          return deferred.resolve(fullList[index]);

        // ELSE 
        } else {
          // Query for all MS that users were listening to this station
          new Date(lastNightMidnightMs - 24*60*60*1000)
          ListeningSession.find({ $and: [ 
                                    { _station: fullList[index]._id },
                                    { $or: [
                                      { startTime: { 
                                        $gte: new Date(lastNightMidnightMs - 24*60*60*1000),
                                        $lt: new Date(lastNightMidnightMs)
                                        }
                                      },
                                      { endTime: {
                                        $gte: new Date(lastNightMidnightMs - 24*60*60*1000),
                                        $lt: new Date(lastNightMidnightMs)
                                        }
                                      }
                                      ]
                                    }
                                  ] 
                                }, function (err, listeningSessions) {
            if (err) return deferred.reject(new Error(err));

            // sum the total ms of listening time
            var totalMS = 0;

            for(var j=0;j<listeningSessions.length;j++) {
              var startTime = new Date(listeningSessions[j].startTime);
              var endTime = new Date(listeningSessions[j].endTime);

              // adjust for starting or ending out of 24-hr range
              if (startTime < new Date(lastNightMidnightMs - 24*60*60*1000)) {
                startTime = new Date(lastNightMidnightMs - 24*60*60*1000);
              }
              if (endTime > new Date(lastNightMidnightMs)) {
                endTime = new Date(lastNightMidnightMs);
              }

              var msInSession = endTime.getTime() - startTime.getTime();
              totalMS += msInSession;
            }

            // store the total
            fullList[index].dailyListenTimeCalculationDate = Date.now();
            fullList[index].dailyListenTimeMS = totalMS;

            fullList[index].save(function (err, station) {
              if (err) return deferred.reject(new Error(err));
              return deferred.resolve(station);
            });
          });
          return deferred.promise;
        }  //ENDIF
      })(i));
    }  // ENDFOR

    // run that shit
    Q.all(getRankFunctions)
    
    .done(function (results) {

      Station
        .find({})
        .limit(30)
        .populate('_user')
        .sort('-dailyListenTimeMS')
        .exec(callback);
    });
  })
}

StationSchema.plugin(timestamps);
var Station = mongoose.model('Station', StationSchema);
module.exports = Station;