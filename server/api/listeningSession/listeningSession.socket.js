/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var ListeningSession = require('./listeningSession.model');

exports.register = function(socket) {
  ListeningSession.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  ListeningSession.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('listeningSession:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('listeningSession:remove', doc);
}