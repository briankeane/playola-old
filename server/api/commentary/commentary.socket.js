/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var Commentary = require('./commentary.model');

exports.register = function(socket) {
  Commentary.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  Commentary.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('commentary:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('commentary:remove', doc);
}