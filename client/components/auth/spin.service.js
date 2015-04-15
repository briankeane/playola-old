'use strict';

angular.module('playolaApp')
  .factory('Spin', function ($resource) {
    return $resource('/api/v1/spins/:id/:controller', {
      id: '@_id'
    },
    {
      move: {
        method: 'PUT',
        params: {
          controller:'move'
        }
      },
      remove: {
        method: 'DELETE',
        params: {
          controller: 'remove'
        }
      },
      insert: {
        method: 'POST',
        params: {
          controller: 'insert'
        }
      }
    });
  });
