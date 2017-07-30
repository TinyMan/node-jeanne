const path = require('path')
const ffmpeg = require('fluent-ffmpeg')
const request = require('request')
const Stream = require('stream')
const minmax = require('stumble/lib/gutil').minmax
const fs = require('fs')
const EventEmitter = require('events')
const Jamy = require('jamy')
const { min, max } = require('lib/utils')
const utils = require('lib/utils')

const radio = require('./extensions/radio')
const youtube = require('./extensions/youtube/youtube')
const Mixer = require('./audio/mixer')
const voice = require('./extensions/voice')
const notepad = require('./extensions/notepad')
const voiceCommand = require('./extensions/voice-command/voice-command')
const phone = require('./extensions/phone')

const logger = require('lib/logger')('extension')

const volumedown = {
	handle: "volumedown",
	exec: function (data) {
		let gain = this.io.input ? this.io.input.gain : this.config.extensions.audio.gain
		gain = max(0.01, gain - this.config.extensions.audio.volumestep)
		if (this.io.input) {
			this.io.input.setGain(gain)
		}
		this.config.extensions.audio.gain = gain
		this.execute('info::gain')
	}
}
const volumeup = {
	handle: "volumeup",
	exec: function (data) {
		let gain = this.io.input ? this.io.input.gain : this.config.extensions.audio.gain
		gain = min(1, gain + this.config.extensions.audio.volumestep)
		if (this.io.input) {
			this.io.input.setGain(gain)
		}
		this.config.extensions.audio.gain = gain
		this.execute('info::gain')
	}
}
const pause = {
	handle: "pause",
	exec: function (data) {
		this.space.get('player').pause()
	}
}
const resume = {
	handle: "play",
	exec: function (data) {
		this.space.get('player').resume()
	}
}
const info = {
	handle: "info",
	extensions: [{
		handle: "info::gain",
		exec: function (data) {
			let gain = this.config.extensions.audio.gain
			if (this.io.input)
				gain = this.io.input.gain
			this.client.user.channel.sendMessage("Current volume: " + (gain * 100).toFixed(2))
		}
	}],
	commands: [{
		handle: 'help',
		exec: function (data) {
			const cmds = [...this.commands.keys()].sort((a, b) => {
				return a.localeCompare(b);
			}).map(cmd => `<li>${cmd}</li>`);

			data.user.sendMessage('List of available commands:');
			const link = utils.link_with_title('https://github.com/TinyMan/node-jeanne#commands', "find information online")
			const message = `<i>You have asked for help.</i>
					<ul>${cmds.join('')}</ul><br>
        			<i>Use <b>info [ COMMAND_NAME ]</b> to gain additional information, or ${link}.</i>`
			utils.autoPartsString(message, 50000, '</li>').forEach(m => data.user.sendMessage(m))
		},
		info: () => `Displays each command currently loaded.`
	}, {
		handle: 'info',
		exec: function info(data) {
			const name = data.message || 'info';
			const aliased = data.message && this.aliases.get(name);
			const target = this.commands.get(aliased || name);

			if (target) {
				if (aliased)
					data.user.sendMessage(`Note: [ ${name} ] is an alias for [ ${aliased} ].`);

				const reply = target.info ? target.info.call(this, this, data) : 'No info available.';
				data.user.sendMessage(reply || `Command [ ${name} ] not found.`);
			}
		},
		info: () => `Provides information about a given command`
	}]
}


const reboot = {
	handle: "reboot",
	exec: _ => process.exit(0)
}

module.exports = {
	handle: 'streaming',
	needs: [],
	init: stumble => {
		const jamy = new Jamy({
			format: "s16le",
			frequency: 48000,
			channels: 1
		})
		const mixer = new Mixer()
		mixer.plug(jamy.stream)
		stumble.space.set("player", jamy)
		stumble.space.set("mixer", mixer)
		stumble.space.set("commands", new EventEmitter())
		if ("voice" in stumble.config.extensions) stumble.use(voice)

	},
	term: stumble => { },
	extensions: [info, youtube, notepad, voiceCommand, phone],
	commands: [radio, volumeup, volumedown, pause, resume, reboot]
}
