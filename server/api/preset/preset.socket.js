/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var Preset = require('./preset.model');

exports.register = function(socket) {
  Preset.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  Preset.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('preset:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('preset:remove', doc);
}