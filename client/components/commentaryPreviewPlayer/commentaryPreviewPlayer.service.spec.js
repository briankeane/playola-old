'use strict';

describe('Service: commentaryPreviewPlayer', function () {

  // load the service's module
  beforeEach(module('wwwApp'));

  // instantiate service
  var commentaryPreviewPlayer;
  beforeEach(inject(function (_commentaryPreviewPlayer_) {
    commentaryPreviewPlayer = _commentaryPreviewPlayer_;
  }));

  it('should do something', function () {
    expect(!!commentaryPreviewPlayer).toBe(true);
  });

});
