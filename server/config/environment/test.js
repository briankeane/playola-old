'use strict';

// Test specific configuration
// ===========================
module.exports = {
  // MongoDB connection options
  mongo: {
    uri: 'mongodb://localhost/pl2nodeyo-test'
  },

  s3Buckets: { 
    SONGS_BUCKET: 'playolasongstest',
    COMMERCIALS_BUCKET: 'playolacommercialstest',
    COMMENTARIES_BUCKET: 'playolacommentariestest',
    UNPROCESSED_SONGS_BUCKET: 'playolaunprocessedsongstest'
  },

  ECHONEST_TASTE_PROFILE_ID: 'CAIQEUO1473A654C51'

};