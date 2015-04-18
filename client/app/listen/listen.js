'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('listen', {
        url: '/station',
        templateUrl: 'app/listen/listenIndex/listenIndex.html',
        controller: 'ListenIndexCtrl',
        authenticate: true
      })
  });