'use strict';

/**
 * Removes server error when user updates input
 */
angular.module('playolaApp')
  .directive('mnHasSub', function($window) {
    return {
      restrict: 'C',
      link: function(scope, element, attrs) {
        var mnThisLi = element.parent("li");
        mnThisLi.bind('mouseenter', function () {
          mnThisLi.find('.mn-sub:first').stop(true, true).fadeIn("fast");
        });
        mnThisLi.bind('mouseleave', function () {
          mnThisLi.find(".mn-sub:first").stop(true, true).delay(100).fadeOut("fast");
        });
      }
    };
  })