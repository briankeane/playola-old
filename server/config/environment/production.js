'use strict';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip:       process.env.OPENSHIFT_NODEJS_IP ||
            process.env.IP ||
            undefined,

  // Server port
  port:     process.env.OPENSHIFT_NODEJS_PORT ||
            process.env.PORT ||
            8080,

  // MongoDB connection options
  mongo: {
    uri:    process.env.MONGOLAB_URI ||
            process.env.MONGOHQ_URL ||
            process.env.OPENSHIFT_MONGODB_DB_URL+process.env.OPENSHIFT_APP_NAME ||
            'mongodb://172.31.51.139:27017/playola'
  },

  s3Buckets: { 
    SONGS_BUCKET: 'playolasongs',
    COMMERCIALS_BUCKET: 'playolacommercials',
    COMMENTARIES_BUCKET: 'playolacommentaries',
    UNPROCESSED_SONGS_BUCKET: 'playolaunprocessedsongs'
  },

  ECHONEST_TASTE_PROFILE_ID: 'CACRWKJ14BA4596CF4'
};