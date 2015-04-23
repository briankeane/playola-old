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
var moment = require('moment');

function Scheduler(station) {
  //  initialize
  var self = this;

  // grab a week's worth of schedule
  var fullSchedule = getFullSchedule();

















  function getFullSchedule() {

  }

}