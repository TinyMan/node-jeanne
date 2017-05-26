const path = require('path')
const ytdl = require('ytdl-core')
const YouTube = require('youtube-node')
const chooseFormat = require("ytdl-core/lib/util").chooseFormat
const fromHumanTime = require("ytdl-core/lib/util").fromHumanTime
const fixedQueue = require('fixedqueue').FixedQueue
const keys = require(path.join(__dirname, "../keys/api-keys.json"))
const promisify = require('es6-promisify')
const cheerio = require('cheerio')
const EventEmitter = require('events').EventEmitter
const utils = require('./utils.js')
const logger = require('./logger.js')('Youtube')
require('autolink-js')

const breakTag = "<br>"
const link_with_title = (link, title = link) => "<a href=\"" + link + "\">" + title + "</a>"
const video_link = (id) => "https://youtu.be/" + id

function ytapi(options) {
	options = Object.assign({}, {
		type: "video"
	}, options)
	let ytapi = new YouTube()
	ytapi.setKey(keys["youtube"])
	for (var k in options)
		ytapi.addParam(k, options[k])
	return ytapi
}

class YoutubePlayer extends EventEmitter {
	constructor(options) {
		super()
		const conf = Object.assign({
			norepeat_length: 15,
			lang: 'fr',
			auto_play: true,
			search_max_results: 5,
			jump_distance: 20000
		}, options)

		this.conf = conf
		this._history = fixedQueue(conf.norepeat_length)
		this.queue = []
		this.playing = false
		this.current_video = null
		this.lang = conf.lang
		this.stream = null
		this._streamer = null
		this.startTime = 0
	}
	set streamer(s) {
		this._streamer = s
		if (s) this._streamer.on('end', e => this.next())
	}
	get streamer() {
		return this._streamer
	}
	playfirst(termsOrLink) {
		// check if we have a link to the video
		let links = []
		cheerio.load(termsOrLink)('a').each((_, el) => {
			const attr = el.attribs['href']
			if (attr) links.push(attr)
		})
		// if we have a link
		if (links.length > 0)
			return this.play(utils.youtube_parser(links[0]))

		// play the first video that match those terms
		return this.search(termsOrLink, 1)
			.then(res => res.items[0].id.videoId)
			.then(id => this.play(id))
	}
	play(id, begin = 0) {
		if (!this.streamer) throw new Error("Error: no streamer available")
		this.streamer.stop()

		// play the video with the id id
		const getById = promisify(ytapi().getById)
		const link = video_link(id)
		return getById(id)
			.then(res => {
				if (res.items.length < 1) throw "No result for video link " + link
				const video = res.items[0] // the first result

				this.current_video = video
				this.emit("play", video)
				const getInfo = promisify(ytdl.getInfo.bind(ytdl))
				return getInfo(link)
			})
			.then(info => {
				this.startTime = fromHumanTime(begin)
				this._history.push(id)
				let format = chooseFormat(info.formats, {
					quality: 'highest',
					filter: "audioonly"
				})
				this.stream = ytdl.downloadFromInfo(info, {
					format,
					begin: this.startTime
				})
				this.stream.on('error', e => { logger.error(e), this.emit('error', e) })
				this.stream.on('abort', e => { logger.error(e), this.emit('abort', e) })
				this.streamer.stream(this.stream)
				this.stream.on('index', index => {
					this.startTime = this.stream.startTime
				})
			})
	}
	stop() {
		if (this.streamer) this.streamer.stop()
		this.queue = []
		this.current_video = null
		this.startTime = 0
	}
	next() {
		// stream next video
		if (this.queue.length > 0) // if we have demands for next
			this.playfirst(this.queue.shift())
		else if (this.conf.auto_play && this.current_video) { // else if auto play is enabled, search for related
			this.getRelated(this.current_video.id)
				.then(video => this.play(video.id.videoId))
		} else {
			this.stop()
			this.emit('message', "Empty queue. Enable auto play to play related videos automatically.")
		}
	}
	add(terms) {
		// add a video to the on-the-fly queue
		this.queue.push(terms)
		this.emit('add', terms)
	}
	addnext(terms) {
		// add a video directly after the current one
		this.queue.unshift(terms)
		this.emit('addnext', terms)
	}
	seek(time) {
		if (this.current_video) this.play(this.current_video.id, time)
		// logger.info("Seeking " + time)
	}
	jumpForward(distance = this.conf.jump_distance) {
		const current = this.streamer.passthrough.totalTime
		this.seek(this.startTime + current + distance)
	}
	jumpBackward(distance = this.conf.jump_distance) {
		const current = this.streamer.passthrough.totalTime
		this.seek(this.startTime + current - distance)
	}
	getRelated(id) {
		const link = video_link(id)
		logger.log("Searching related for " + id + "(" + link + ")")
		const related = promisify(ytapi().related)
		return related(id, this.conf.norepeat_length + 1)
			.then(res => {
				if (res.items.length < 1) throw new Error('No related found')
				let item = null
				let i = 0
				let found = false
				while (!found && i < res.items.length) {
					found = this._history.indexOf(res.items[i++].id.videoId) === -1
				}
				if (found) return res.items[i - 1]
				else throw new Error('No related found')
			})
	}
	search(terms, max_results = this.conf.search_max_results) {
		logger.log("Searching video with terms: " + terms)
		const search = promisify(ytapi().search)
		return search(terms, max_results)
			.then(res => {
				if (res.items.length > 0)
					return res
				else {
					this.emit('message', 'No video found: <b>' + terms + '</b>')
					throw new Error('No video found with those terms: ' + terms)
				}
			})
	}
}

const play = {
	handle: 'yt',
	exec: function (data) {
		this.space.get('youtube-player').playfirst(data.message)
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
		this.space.get('youtube-player').stop()
	}
}
const next = {
	handle: "next",
	exec: function (data) {
		this.space.get('youtube-player').next()
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

const search = {
	handle: "search",
	exec: function (data) {
		if (!data.message) {
			return // error
		}
		const stumble = this
		const terms = data.message
		this.space.get('youtube-player').search(terms)
			.then(res => {
				const breakTag = "<br>"
				let message = "Search results for <b>" + terms + "</b>:" + breakTag
				for (let i in res.items) {
					const id = res.items[i].id.videoId
					const title = res.items[i].snippet.title
					// TODO: second request getById on comma separated id list to get duration and other stats
					message += i + ". " + link_with_title(video_link(id), title) + breakTag
				}
				utils.autoPartsString(message, 50000, "<br>").forEach(m => stumble.client.user.channel.sendMessage(m))
			})
			.catch(e => logger.error(e))
	}
}

const info = {
	handle: "youtube::info",
	init: stumble => {
		const player = stumble.space.get('youtube-player')
		player.on('play', v => stumble.execute("youtube::info::playing", v))
		player.on('add', v => stumble.execute("youtube::info::added", v))
		player.on('addnext', v => stumble.execute("youtube::info::next", v))
		player.on('message', m => stumble.client.user.channel.sendMessage(m))
	},
	extensions: [{
		handle: "youtube::info::playing",
		exec: function (video) {
			const id = video.id
			const link = video_link(id)
			let message = "Now playing: <b>" + link_with_title(link, video.snippet.title) + "</b> (" + utils.convertISO8601ToSring(video.contentDetails.duration) + ")"
			this.client.user.channel.sendMessage(message)
		}
	},
	{
		handle: "youtube::info::description",
		exec: function (video) {
			const id = video.id
			const link = video_link(id)
			let message = "<b>" + link_with_title(link, video.snippet.title) + "</b> (" + utils.convertISO8601ToSring(video.contentDetails.duration) + ")" + breakTag
			message += video.snippet.description.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)+/g, '$1' + breakTag + '$2').autoLink()
			utils.autoPartsString(message, 50000, "<br>").forEach(m => this.client.user.channel.sendMessage(m))
		}
	}, {
		handle: "youtube::info::next",
		exec: function (terms) {
			let message = "Suivante: <b>" + terms + "</b>"
			this.client.user.channel.sendMessage(message)
		}
	},
	{
		handle: "youtube::info::added",
		exec: function (terms) {
			let message = "La video <b>" + terms + "</b> a été ajoutée à la playlist."
			this.client.user.channel.sendMessage(message)
		}
	}
	]
}


module.exports = {
	handle: 'youtube',
	needs: [],
	init: stumble => {
		// mount script
		const player = new YoutubePlayer(stumble.config.extensions.youtube)
		player.streamer = stumble.space.get('streamer')
		stumble.space.set("youtube-player", player)
	},
	term: stumble => {
		// unmount script
		const player = stumble.space.get("youtube-player")
		// destroy things
	},
	extensions: [info],
	commands: [play, stop, next, add, addnext, search, description, seek, jumpForward, jumpBackward]
}
