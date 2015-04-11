var fs = require('fs');
var csv = require('fast-csv');
var https = require('https');


function TimezoneFinder() {
  var self = this;
  var latLongCSVFile = './cityzip.csv';

  
  this.findByZip = function (zip, callback) {
    var latitude;
    var longitude;
    var state;
    var city;
    var foundZip = false;

    var stream = fs.createReadStream(__dirname + '/cityzip.csv');

    stream.pipe(csv())
    .on("data", function (data) {
      
      // if it's the first time it sees the zipcode, send the request
      if ((data[2] === zip) && !foundZip) {
        foundZip = true;
        latitude = data[3];
        longitude = data[4];
        state = data[0];
        city = data[1];

        stream.close();

        var options = {
          hostname: 'maps.googleapis.com',
          path: '/maps/api/timezone/json?location=' + latitude + ',' + longitude + '&timestamp=' + Math.floor(Date.now()/1000),
          method: 'GET'
        }

        var req = https.request(options, function (res) {
          var responseString = '';

          // add data as it comes
          res.on('data', function (data) {
            responseString += data;
          });

          // when finished, parse data and run callback with result
          res.on('end', function() {
            var responseObject = JSON.parse(responseString);
            callback(null, responseObject["timeZoneId"]);
          });
        });
        req.end();

        req.on('error', function (err) {
          callback(err, null);
        });
      }
    })
    .on('end', function() {
      if (!foundZip) {
        callback(new Error('Zipcode not found'), null);
      }
    });
  }
}

module.exports = new TimezoneFinder();