_ = require('lodash');

function rules() {
  var self = this;

  this.dayOffset = function (attrs) {
    var songChoices = attrs.songlist;

    var windowStart = new Date(attrs.airtime.getTime() - 1000*60*60*24 - ((attrs.windowSizeMinutes/2.0)*1000*60));
    var windowEnd = new Date(attrs.airtime.getTime() - 1000*60*60*24 + ((attrs.windowSizeMinutes/2.0)*1000*60));

    // grab unusable song ids
    var spinsFromYesterday = _.filter(attrs.schedule, function (spin) {
      return ((spin.airtime > windowStart) && (spin.airtime < windowEnd)); 
    });

    var usedSongs = {};
    // make an object to search
    for (var i=0;i<spinsFromYesterday.length;i++) {
      usedSongs[spinsFromYesterday[i]._audioBlock.id] = true;
    }

    var usableSongs = _.filter(songChoices, function (song) { return (!usedSongs[song.id]); });

    return usableSongs;
  }

  this.artistMinimumRest = function (attrs) {
    var songChoices = attrs.songlist;
    var windowStart = new Date(attrs.airtime.getTime() - attrs.minutesOfRest*60*1000);

    var recentSpins = _.filter(attrs.schedule, function (spin) {
      return ((spin.airtime > windowStart) && (spin.airtime <= (new Date(attrs.airtime.getTime() + 10000))));   // 10 secs after song start
    });

    // create a searchable object
    var usedArtists = {};
    for (var i=0;i<recentSpins.length;i++) {
      usedArtists[recentSpins[i]._audioBlock.artist] = true;
    }
    var usableSongs = _.filter(songChoices, function (song) { return (!usedArtists[song.artist]); });
    return usableSongs;
  };

  this.songMinimumRest = function (attrs) {
    var minutesOfRest = attrs.minutesOfRest || 70;
    var songChoices = attrs.songlist;
    var windowStart = new Date(attrs.airtime.getTime() - minutesOfRest*60*1000);
    var recentSpins = _.filter(attrs.schedule, function (spin) {

      return ((spin.airtime >= windowStart) && (spin.airtime <= (new Date(attrs.airtime.getTime() + 10000))));
    });

    var usedSongs = {};
    for (var i=0;i<recentSpins.length;i++) {
      usedSongs[recentSpins[i]._audioBlock.id] = true;
    }

    var usableSongs = _.filter(songChoices, function (song) { return (!usedSongs[song.id]); });

    return usableSongs;
  };
}

module.exports = new rules();