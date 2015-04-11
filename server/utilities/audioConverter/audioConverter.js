var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var fs = require('fs');

function AudioConverter() {
  var self = this;

  this.convertFile = function (filepath, callback) {
    var newFilepath = process.cwd() + '/server/data/processedAudio/' + path.basename(filepath)
    var duration;

    // fix the extension for the output
    newFilepath = newFilepath.replace('.m4a','.mp3');
    newFilepath = newFilepath.replace('.wav', '.mp3');
    newFilepath = newFilepath.replace('.m4p', '.mp3');

    // run the conversion
    ffmpeg(filepath)
    .audioCodec('libmp3lame')
    .output(newFilepath)
    .on('error', function (err) {
      if (err.message.substr('Operation not permitted')) {
        var error = new Error('File is Copy-Protected');  
        callback(error, null)
      }
    })
    .on('end', function () {
      fs.unlink(filepath, function (err) {
        if (err) throw err;

        callback(null, newFilepath);
      })
    })
    .outputOptions('-write_xing 0')
    .run();
  }

}

module.exports = new AudioConverter();