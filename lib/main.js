const s = require('lib/mumble/stumble-instance')
const logger = require('lib/logger')('main')
const minmax = (a, b, c) => b < a ? a : b > c ? c : b

function main() {
	s.client.connection.on('error', e => {
		logger.error(e)
		logger.log(e.data)
	})
	s.client.on('user-disconnect', (user) => {
		setImmediate(() => {
			logger.log("User " + user.name + " disconnected.")
			const u = s.client.users()
			if (u.length == 1) {
				logger.log("No one left on the server, stoping the music...")
				s.invoke('stop')
			}
		})
	})

	if (!s.io.input) {
		s.io.establish({
			input: true,
			inputOptions: {
				channels: 1,
				sampleRate: 48000,
				gain: minmax(0.01, s.config.extensions.audio.gain, 1.0),
			}
		})
		this.space.set('audio.streaming', true)
	}
	s.space.get('mixer').pipe(s.io.input)

}

module.exports = main
