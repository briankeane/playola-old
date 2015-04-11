/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var CommercialBlock = require('./commercialBlock.model');

exports.register = function(socket) {
  CommercialBlock.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  CommercialBlock.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('commercialBlock:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('commercialBlock:remove', doc);
}