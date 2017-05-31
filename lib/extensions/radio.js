const request = require('request')
const path = require('path')
const Stream = require('stream')
const radios = require(path.join(__dirname, "../../data/radios.json"))
const logger = require('../logger.js')('Radios')


const radio = {
    handle: 'radio',
    exec: function(data) {
        const stumble = this

        const links = stumble.execute('parser::getlinks', {
            html: data.message
        })
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

        const st = new Stream.PassThrough()
        request(link).pipe(st)
        stumble.space.get('streamer').stop()
        stumble.space.get('streamer').stream(st)
    }
}
module.exports = radio
