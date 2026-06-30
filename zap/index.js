const createOneTimeLink = require('./creates/create_one_time_link');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  triggers: {},

  searches: {},

  creates: {
    [createOneTimeLink.key]: createOneTimeLink,
  },

  resources: {},
};
