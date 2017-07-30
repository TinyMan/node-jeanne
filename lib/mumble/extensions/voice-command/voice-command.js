const commands = require('./speech-commands')
const SpeechStream = require('lib/model/speechstream')
const BreakException = require('lib/utils').BreakException
const logger = require('lib/logger')('voice-command')

module.exports = {
	handle: 'voice-command',
	init: async stumble => {
		const speechstream = SpeechStream()
		speechstream.textStream.on('data', transcripts => stumble.execute('voice-command::detect', transcripts))
		stumble.space.set('speechstream', speechstream)
		stumble.on('ready', () => stumble.execute('voice-command::start'))
	},
	extensions: [{
		handle: "voice-command::start",
		exec: async function () {
			this.client.connection.ignoreLastAudioFrame = true
			this.client.connection.ignoreNormalTalking = true
			this.io.establish({
				output: true,
				outputFrom: true
			})
			this.io.output.pipe(this.space.get('speechstream'))
		}
	}, {
		handle: "voice-command::stop",
		exec: async function () {
			this.client.connection.ignoreNormalTalking = false
			this.client.connection.ignoreLastAudioFrame = false

			this.io.output.unpipe()

		}
	}, {
		handle: "voice-command::detect",
		exec: async function (transcripts) {
			try {
				for (let name in commands) {
					let command = commands[name]
					if (!command.func) return
					if (typeof command.detector === "object" && command.detector instanceof RegExp) {
						transcripts.forEach((tr) => {
							let matches = command.detector.exec(tr.transcript)
							if (matches) {
								command.func.call(this, matches, tr)
								throw new BreakException(name, tr.transcript)
							}
						})
					} else if (typeof command.detector === "function") {
						command.detector.call(this, transcripts, command.func)
					} else {
						logger.error('Voice command detector not implemented for ' + name)
					}
				}
			} catch (e) {
				if (!(e instanceof BreakException)) throw e
				logger.log("Found match: " + e.command, e.transcript)
			}

		}
	}]
}