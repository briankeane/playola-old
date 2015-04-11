/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var Station = require('./station.model');

exports.register = function(socket) {
  Station.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  Station.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('station:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('station:remove', doc);
}