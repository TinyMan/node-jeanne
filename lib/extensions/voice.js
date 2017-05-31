const path = require('path')
const fs = require('fs')
const logger = require('../logger')('voice')


function getFile(filename) {
	return path.resolve(__dirname, '../../data/voice', filename)
}
function getStream(file) {
	const st = fs.createReadStream(file).on('error', e => {
		st.unpipe()
		logger.error(e)
	})	
	return st
}
const playvoice = {
	handle: "voice::play",
	exec: function ({ filename, user }) {
		const file = getFile(filename)

		const mixer = this.space.get('mixer')
		if (!mixer.piped) {
			logger.log("Playing file " + file)
			if (!user) {
				// getStream(file).pipe(mixer, { end: false })
				if (this.client.user.channel.users.length > 1)
					mixer.plug(getStream(file))
			} else {
				const stream = this.client.inputStreamForUser(user.session, { gain: this.config.extensions.voice.gain })
				getStream(file).pipe(stream)
			}
		}
	}
}

const playRandom = {
	handle: "voice::playRandom",
	exec: function ({ category, user, id }) {
		// logger.log("Playing random voice sample from " + category)
		const samples = this.space.get('voice:map')[category]
		if (!samples) return
		if (!id) id = Math.floor(Math.random() * samples.length)
		const filename = samples[id]
		this.execute("voice::play", { filename, user })
	}
}
const playIdle = {
	handle: "voice::playIdle",
	exec: function () {
		const range = this.config.extensions.voice.idle_timer.max - this.config.extensions.voice.idle_timer.min
		const time = (Math.random() * range + this.config.extensions.voice.idle_timer.min) * 1000 // config is in seconds
		// logger.log(time)
		setTimeout(() => {
			if (this.client.users().length > 0)
				this.execute("voice::playRandom", { category: "idle" })
			this.execute("voice::playIdle")
		}, time)
	}
}

module.exports = {
	handle: 'voice',
	needs: [],
	init: stumble => {
		try {
			stumble.space.set('voice:map', require(stumble.config.extensions.voice.map))
		} catch (e) {
			return logger.error(e)
		}
		// setup listeners
		stumble.on('ready', () => {
			logger.log('Started')
			const client = stumble.client
			client.on('user-move', (user, fromChannel, toChannel, actor) => {
				// logger.log("User " + user.name + " moved from channel " + fromChannel.name + " to " + toChannel.name + " by " + actor.name);
				if (toChannel === client.user.channel) // user joined our channel
					stumble.execute("voice::playRandom", { category: "welcome" })
				else if (fromChannel === client.user.channel) { // user left our channel
					stumble.execute("voice::playRandom", { category: "goodbye", user })
				}
			})
			client.on('user-connect', user => {
				if (user.channel === client.user.channel)
					stumble.execute("voice::playRandom", { category: "welcome" })
			})
		})
		stumble.space.get('commands').on('stop', () => setImmediate(() => stumble.execute("voice::playRandom", { category: "stop" })))
		stumble.space.get('commands').on('search', terms => setImmediate(() => stumble.execute("voice::playRandom", { category: "special", id: "searching" })))
		stumble.on('ready', () => stumble.execute('voice::playIdle'))
	},
	term: stumble => { },
	extensions: [playvoice, playRandom, playIdle],
	commands: []
}