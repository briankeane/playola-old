'use strict';

// Development specific configuration
// ==================================
module.exports = {
  // MongoDB connection options
  mongo: {
    uri: 'mongodb://localhost/pl2nodeyo-dev'
  },

  seedDB: false,

  s3Buckets: { 
    SONGS_BUCKET: 'playolasongsdevelopment',
    COMMERCIALS_BUCKET: 'playolacommercialblocks',
    COMMENTARIES_BUCKET: 'playolacommentariesdevelopment',
    UNPROCESSED_SONGS_BUCKET: 'playolaunprocessedsongsdevelopment'
  },

  ECHONEST_TASTE_PROFILE_ID: 'CAMCWVM14BECED787C'
};
