const debug = require('debug')
let NS = ""
/* eslint no-console: "off" */
module.exports = function (module) {
	const logger = {}
	logger.log = debug(NS + ":" + module)
	logger.log.log = console.log.bind(console)	
	logger.log.color = 6
	logger.warn = debug(NS + ":" + module)
	logger.warn.log = console.warn.bind(console)
	logger.warn.color = 3
	logger.info = debug(NS + ":" + module)
	logger.info.log = console.info.bind(console)
	logger.info.color = 5
	logger.error = debug(NS + ":" + module)
	logger.error.log = console.error.bind(console)
	logger.error.color = 1
	return logger
}
module.exports.setNS = (ns) => NS = ns
module.exports.enable = debug.enable
module.exports.disable = debug.disable
module.exports.save = debug.save
module.exports.log = debug.log
module.exports.load = debug.load