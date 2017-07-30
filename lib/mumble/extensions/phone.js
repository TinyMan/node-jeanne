const sylvia = require('sylvia')
const htmlToText = require('html-to-text')

const utils = require('lib/utils')
const logger = require('lib/logger')('phone')
const serialLogger = require('lib/logger')('phone::serial')

module.exports = {
	handle: "phone",
	init: async stumble => {
		const phone = new sylvia.phone()
		stumble.space.set('phone', phone)
		phone.on('error', e => logger.error(e))
		phone.on('sms', async sms => await handle('phone::handler::sms', sms))
		phone.on('sms-sent', async id => await handle('phone::handler::sms-sent', id))
		phone.on('ring', async () => await handle('phone::handler::ring'))
		phone.on('clip', async clip => await handle('phone::handler::ring', clip))
		phone.on('hangup', async () => await handle('phone::handler::hangup'))
		phone.on('serial-msg', msg => serialLogger.info(msg))

		stumble.on('ready', async () => await handle('phone::start'))

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

		}
	}, {
		handle: "phone::handler::hangup",
		exec: async function (clip) {

		}
	}, {
		handle: "phone::disconnect-call",
		exec: async function () {

		}
	}, {
		handle: "phone::connect-call",
		exec: async function (data) {

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

		}
	}, {
		handle: "hangup",
		exec: async function (data) {

		}
	}, {
		handle: "answer",
		exec: async function (data) {

		}
	}]
}