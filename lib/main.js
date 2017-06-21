const commands = require('./speech-commands.js')
const pass = require('./speechstream.js')()
const s = require('./stumble-instance.js')
const BreakException = require('./utils.js').BreakException
const logger = require('./logger.js')('main')
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
	s.client.connection.ignoreNormalTalking = true
	s.client.connection.ignoreLastAudioFrame = true
	s.io.establish({
		output: true,
		outputFrom: true
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


	s.io.output.pipe(pass)


	pass.textStream.on('data', function (transcripts) {
		//logger.log(transcripts)

		try {
			for (let name in commands) {
				let command = commands[name]
				if (!command.func) return
				if (typeof command.detector === "object" && command.detector instanceof RegExp) {
					transcripts.forEach((tr) => {
						let matches = command.detector.exec(tr.transcript)
						if (matches) {
							command.func(matches, tr)
							throw new BreakException(name, tr.transcript)
						}
					})
				} else if (typeof command.detector === "function") {
					command.detector(transcripts, command.func)
				} else {
					logger.error('Voice command detector not implemented for ' + name)
				}
			}
		} catch (e) {
			if (!(e instanceof BreakException)) throw e
			logger.log("Found match: " + e.command, e.transcript)
		}


	})
}

module.exports = main
