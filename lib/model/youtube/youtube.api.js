const path = require('path')
const YouTube = require('youtube-node')

const keys = require('keys/api-keys.json')

module.exports = function ytapi(options) {
	options = Object.assign({}, {
		type: "video"
	}, options)
	let ytapi = new YouTube()
	ytapi.setKey(keys["youtube"])
	for (var k in options)
		ytapi.addParam(k, options[k])
	return ytapi
}