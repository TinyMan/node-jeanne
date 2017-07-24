const utils = require('lib/utils')
const logger = require('lib/logger')('youtube')

const info = require('./youtube.info')
const playlist = require('./youtube.playlist')
const subscription = require('./youtube.suscription')

const YoutubePlayer = require('lib/model/youtube/youtube.player')

const trending = {
	handle: "youtube::playlist::dynamic::trending",
	exec: async function (data) {
		const stumble = this
		const player = stumble.space.get('youtube-player')
		let regionCode = player.lang
		if (data && data.message && data.message.length)
			regionCode = /([a-z]{2})/i.exec(data.message)[1]

		const mostPopular = (await player.mostPopular(regionCode)).items.map(({ id }) => id)
		return mostPopular
	}
}

const play = {
	handle: 'yt',
	exec: function (data) {
		const player = this.space.get('youtube-player')
		player.queue = []
		player.playfirst(data.message).catch(e => { logger.error(e) })
	}
}
const addnext = {
	handle: "addnext",
	exec: function (data) {
		this.space.get('youtube-player').addnext(data.message)
	}
}
const add = {
	handle: "add",
	exec: function (data) {
		this.space.get('youtube-player').add(data.message)
	}
}
const stop = {
	handle: "stop",
	exec: function (data) {
		this.space.get('commands').emit('stop')
		this.space.get('youtube-player').stop()
	}
}
const next = {
	handle: "next",
	exec: function (data) {
		this.space.get('youtube-player').next()
	}
}
const previous = {
	handle: "previous",
	exec: function (data) {
		this.space.get('youtube-player').previous()
	}
}
const description = {
	handle: "description",
	exec: function (data) {
		const video = this.space.get('youtube-player').current_video
		if (video) {
			this.execute("youtube::info::description", video)
		}
	}
}
const seek = {
	handle: "seek",
	exec: function (data) {
		this.space.get('youtube-player').seek(data.message)
	}
}
const jumpForward = {
	handle: "jumpf",
	exec: function (data) {
		this.space.get('youtube-player').jumpForward()
	}
}
const jumpBackward = {
	handle: "jumpb",
	exec: function (data) {
		this.space.get('youtube-player').jumpBackward()
	}
}
const related = {
	handle: "related",
	exec: async function (data) {
		const related = await this.space.get('youtube-player').related
		return this.execute('youtube::info::displayVideoList', related)
	}
}

const search = {
	handle: "search",
	exec: function (data) {
		if (!data.message) {
			return // error
		}
		const stumble = this
		const terms = data.message
		this.space.get('commands').emit('search', terms)
		this.space.get('youtube-player').search(terms)
			.then(res => {
				let message = "Search results for <b>" + terms + "</b>:" + utils.breakTag
				for (let i in res.items) {
					const id = res.items[i].id.videoId
					const title = res.items[i].snippet.title
					const channelTitle = res.items[i].snippet.channelTitle
					// TODO: second request getById on comma separated id list to get duration and other stats
					message += i + ". " + utils.link_with_title(utils.video_link(id), title) + ', <b>' + channelTitle + '</b>' + utils.breakTag
				}
				utils.autoPartsString(message, 50000, "<br>").forEach(m => stumble.client.user.channel.sendMessage(m))
			})
			.catch(e => logger.error(e))
	}
}

module.exports = {
	handle: 'youtube',
	needs: [],
	init: stumble => {
		// mount script
		const player = new YoutubePlayer(stumble.config.extensions.youtube)
		player.player = stumble.space.get('player')
		stumble.space.set("youtube-player", player)
	},
	term: stumble => {
		// unmount script
		const player = stumble.space.get("youtube-player")
		// destroy things
	},
	extensions: [info, playlist, subscription, trending],
	commands: [play, stop, next, add, addnext, search, description, seek, jumpForward, jumpBackward, previous, related]
}
