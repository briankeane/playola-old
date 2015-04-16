'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('songManager', {
        url: '/station/songManager',
        templateUrl: 'app/station/songManager/songManager.html',
        controller: 'SongManagerCtrl',
        authenticate: true
      })

      .state('djBooth', {
        url:'/station/djBooth',
        templateUrl: 'app/station/djBooth/djBooth.html',
        controller: 'djBoothCtrl',
        authenticate: true
      })

      .state('songMarkup', {
        url: '/station/songMarkup',
        templateUrl: 'app/station/songMarkup/songMarkup.html',
        controller: 'SongMarkupCtrl',
        authenticat: true
      });
  });