const path = require('path')
const paths = require('app-module-path').addPath(__dirname)

const debug = require('lib/logger')
debug.setNS("jeanne")
debug.enable("jeanne:*")

const main = require('lib/main')

const s = require('lib/mumble/stumble-instance');

s.on('ready', main);
debug('').log("Started")
