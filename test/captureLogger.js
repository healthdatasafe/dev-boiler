// Test sink: a boiler custom logger that records what reaches the transports
// (i.e. post-redaction output from Logger.log).
global.__captured = global.__captured || [];

module.exports = {
  async init () {},
  log (level, key, message, context) {
    global.__captured.push({ level, key, message, context });
  }
};
