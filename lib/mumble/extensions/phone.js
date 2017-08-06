const sylvia = require('sylvia')
const htmlToText = require('html-to-text')

const utils = require('lib/utils')
const logger = require('lib/logger')('phone')
const serialLogger = require('lib/logger')('phone::serial')
const audioLogger = require('lib/logger')('phone::audio')

module.exports = {
	handle: "phone",
	init: async stumble => {
		return new Error('Not implemented')
		try {
			const phone = new sylvia()
			stumble.space.set('phone', phone)
			phone.on('error', e => logger.error(e))
			phone.on('sms', async sms => await handle('phone::handler::sms', sms))
			phone.on('sms-sent', async id => await handle('phone::handler::sms-sent', id))
			phone.on('ring', async () => await handle('phone::handler::ring'))
			phone.on('clip', async clip => await handle('phone::handler::ring', clip))
			phone.on('hangup', async () => await handle('phone::handler::hangup'))
			phone.on('call-connected', async () => await handle('phone::connect-call'))
			phone.on('serial-msg', msg => serialLogger.info(msg))
			phone.audioIn.on('error', e => audioLogger.error(e))
			phone.audioOut.on('error', e => audioLogger.error(e))

			stumble.on('ready', async () => await handle('phone::start'))

			stumble.space.set('phone.connected', false)

		} catch (e) {
			logger.error(e)
		}
		async function handle(method, ...args) {
			try {
				logger.log("Handling method " + method)
				return await stumble.execute(method, ...args)
			} catch (e) {
				logger.error(e)
			}
		}
	},
	extensions: [{
		handle: "phone::handler::sms-sent",
		exec: async function (id) {
			// update database
			this.client.user.channel.sendMessage('Sms sent with id <b>' + id + '</b>')
		}
	},
	{
		handle: "phone::handler::sms",
		exec: async function (sms) {
			// update database
			this.execute('phone::display::sms', sms)
		}
	}, {
		handle: "phone::handler::ring",
		exec: async function (clip) {
			let message = 'RING'
			if (clip) {
				message = "Incoming call from " + clip
			}
			this.client.user.channel.sendMessage(message)
		}
	}, {
		handle: "phone::handler::hangup",
		exec: async function (clip) {
			this.client.user.channel.sendMessage('Hangup')
			await this.execute('phone::disconnect-call')
		}
	}, {
		handle: "phone::disconnect-call",
		exec: async function () {
			if (!this.space.get('phone.connected')) return

			const mixer = this.space.get('mixer')
			const player = this.space.get('player')
			const phone = this.space.get('phone')

			this.io.nullify({ output: true })

			phone.audioOut.stream.unpipe()
			mixer.pipe(this.io.input)

			this.execute('voice-command::start')
			this.space.set('phone.connected', false)
		}
	}, {
		handle: "phone::connect-call",
		exec: async function (data) {
			const mixer = this.space.get('mixer')
			const player = this.space.get('player')
			const phone = this.space.get('phone')

			// stop what we're doing
			mixer.unpipe()
			this.execute('voice-command::stop')

			// mumble -> phone
			this.io.output.pipe(phone.audioIn.stream)

			// phone -> mumble
			phone.audioOut.stream.pipe(this.io.input)
			this.space.set('phone.connected', true)
		}
	}, {
		handle: "phone::display::sms",
		exec: async function (sms) {
			const message = sms.time.toLocaleString(this.config.locale || 'fr') + ", <b>" + sms.sender + "</b>:<br>" + sms.text.replace(/(\r\n?|\r?\n)/, '<br>')
			utils.autoPartsString(message, 50000, utils.breakTag).forEach(m => this.client.user.channel.sendMessage(m))
		}
	}, {
		handle: "phone::display::status-report",
		exec: async function (data) {

		}
	}, {
		handle: "phone::start",
		exec: async function () {
			const phone = this.space.get('phone')
			return await phone.start()
		}
	}, {
		handle: "phone::stop",
		exec: async function () {
			const phone = this.space.get('phone')
			return await phone.stop()
		}
	}],
	commands: [{
		handle: "sms",
		exec: async function (data) {
			try {
				const matches = /^ *([^ ]+) (.+)$/.exec(data.message)
				const recipient = matches[1]
				const msg = htmlToText.fromString(matches[2], {
					hideLinkHrefIfSameAsText: true,
					ignoreImage: true
				})
				const phone = this.space.get('phone')
				phone.sendSms(msg, recipient)
			} catch (e) {
				logger.error(e)
			}
		}
	}, {
		handle: "dial",
		exec: async function (data) {
			const phone = this.space.get('phone')
			try {
				const m = data.message.match(/\+?\d+/)
				if (m) {
					logger.log("Dialing " + m[0])
					await phone.dial(m[0])
				} else {
					data.user.sendMessage('Invalid number')
				}
			} catch (e) {
				logger.error(e)
			}
		}
	}, {
		handle: "hangup",
		exec: async function (data) {
			await this.space.get('phone').hangup()
		}
	}, {
		handle: "answer",
		exec: async function (data) {
			await this.space.get('phone').answer()
		}
	}]
}