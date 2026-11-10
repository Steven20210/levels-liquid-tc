// Node entry for the pure modules (tests, scripts). In the browser each module attaches to
// the shared `LCTC` global instead, in the order listed in manifest.json.
module.exports = Object.assign(
  {},
  require('./names.js'),
  require('./money.js'),
  require('./secIndex.js'),
  require('./liquid.js')
);
