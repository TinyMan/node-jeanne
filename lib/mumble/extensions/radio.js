const request = require('request')
const path = require('path')
const Stream = require('stream')
const radios = require("data/radios.json")
const logger = require('lib/logger')('radio')

const utils = require('lib/utils')


const radio = {
	handle: 'radio',
	exec: function (data) {
		const stumble = this
		const links = utils.getLinks(data.message)
		let link = ""
		if (links.length < 1) {
			const r = {}
			try {
				const name = data.message.toLowerCase()
				//logger.log(name, radios[name])
				Object.assign(r, radios[name])
				link = r.url
				if (!link || typeof link == "undefined")
					throw new Error
			} catch (e) {
				this.client.user.channel.sendMessage("<b>Error:</b> no link provided")
				let radioList = ""
				for (let e in radios) {
					radioList += "<b>" + radios[e].name + "</b>, "
				}
				radioList += "<b>Total</b>: " + Object.keys(radios).length
				this.client.user.channel.sendMessage(radioList)
				return
			}
			this.client.user.channel.sendMessage("<b>Streaming</b> " + r.name)
		} else {
			link = links[0]
			this.client.user.channel.sendMessage("<b>Streaming</b> " + link)
		}
		stumble.invoke('stop')
		stumble.space.get('player').play({ url: link })
	}
}
module.exports = radio
