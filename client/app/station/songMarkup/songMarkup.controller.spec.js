'use strict';

describe('Controller: SongMarkupCtrl', function () {

  // load the controller's module
  beforeEach(module('pl2NodeYoApp'));

  var SongMarkupCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    SongMarkupCtrl = $controller('SongMarkupCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
