/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var AudioBlock = require('./audioBlock.model');

exports.register = function(socket) {
  AudioBlock.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  AudioBlock.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('audioBlock:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('audioBlock:remove', doc);
}