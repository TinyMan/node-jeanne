s = require('./lib/stumble-instance.js');

const main = require('./lib/main.js')

s.on('ready', main);
console.log("Started")
