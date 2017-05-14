const debug = require('./lib/logger.js')
debug.setNS("jeanne")
debug.enable("jeanne:*")

const main = require('./lib/main.js')

const s = require('./lib/stumble-instance.js');

s.on('ready', main);
debug('').log("Started")
