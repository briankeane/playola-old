/**
 * Main application routes
 */

'use strict';

var multer = require('multer');

var errors = require('./components/errors');

module.exports = function(app) {

  app.use(multer({dest: process.cwd() + '/server/data/unprocessedAudio'}));
  // Insert routes below
  app.use('/api/v1/presets', require('./api/preset'));
  app.use('/api/v1/listeningSessions', require('./api/listeningSession'));
  app.use('/api/v1/spins', require('./api/spin'));
  app.use('/api/v1/songs', require('./api/song'));
  app.use('/api/v1/logEntries', require('./api/logEntry'));
  app.use('/api/v1/commercialBlocks', require('./api/commercialBlock'));
  app.use('/api/v1/commentaries', require('./api/commentary'));
  app.use('/api/v1/audioBlocks', require('./api/audioBlock'));
  app.use('/api/v1/rotationItems', require('./api/rotationItem'));
  app.use('/api/v1/stations', require('./api/station'));
  app.use('/api/v1/uploads', require('./api/upload'));
  app.use('/api/things', require('./api/thing'));
  app.use('/api/v1/users', require('./api/user'));

  app.use('/auth', require('./auth'));
  
  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
   .get(errors[404]);

  // All other routes should redirect to the index.html
  app.route('/*')
    .get(function(req, res) {
      res.sendfile(app.get('appPath') + '/index.html');
    });
};