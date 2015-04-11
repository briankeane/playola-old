/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var Spin = require('./spin.model');

exports.register = function(socket) {
  Spin.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  Spin.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('spin:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('spin:remove', doc);
}