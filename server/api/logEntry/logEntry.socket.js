/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var LogEntry = require('./logEntry.model');

exports.register = function(socket) {
  LogEntry.schema.post('save', function (doc) {
    onSave(socket, doc);
  });
  LogEntry.schema.post('remove', function (doc) {
    onRemove(socket, doc);
  });
}

function onSave(socket, doc, cb) {
  socket.emit('logEntry:save', doc);
}

function onRemove(socket, doc, cb) {
  socket.emit('logEntry:remove', doc);
}