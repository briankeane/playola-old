/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var RotationItem = require('./rotationItem.model');

exports.register = function(socket) {
  RotationItem.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  RotationItem.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('rotationItem:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('rotationItem:remove', doc);
}