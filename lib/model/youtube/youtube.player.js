const EventEmitter = require('events')
const fixedQueue = require('fixedqueue').FixedQueue
const cheerio = require('cheerio')
const promisify = require('util').promisify
const ytdl = require('ytdl-core')
const { chooseFormat, fromHumanTime } = require("ytdl-core/lib/util")

const utils = require('lib/utils')
const logger = require('lib/logger')('youtube:player')

const ytapi = require('./youtube.api')

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
		this.player = null
		this.last_video = null
	}
	set player(s) {
		this._player = s
		if (s) {
			this._player.on('error', e => logger.error(e))
			this.player.on('naturalEnd', this.next.bind(this))
			this.player.on('seek', time => time > 0 && this.emit('message', "Seeking " + utils.humanTime(time)))
		}
	}
	get player() { return this._player }
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
	play(id) {
		if (!this.player) throw new Error("Error: no player available")
		logger.log("Playing " + id)
		if (typeof id !== "string" || id.length > 11 || !(/[^"&?/ ]{11}/.test(id))) return this.playfirst(id)
		this.emit("stop", this.current_video)
		if (this.current_video) this.last_video = this.current_video

		// play the video with the id id
		const getById = promisify(ytapi().getById)
		const link = utils.video_link(id)
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
				this._history.push(id)
				let format = ytdl.chooseFormat(info.formats, {
					quality: 'highest',
					filter: "audioonly"
				})
				this.player.play(format)
			})
	}
	playQueue() {
		if (this.queue.length > 0) this.play(this.queue.shift())
	}
	stop() {
		if (this.player) this.player.stop()
		this.emit("stop", this.current_video)
		this.queue = []
		this.last_video = this.current_video
		this.current_video = null
	}
	next() {
		if (!this.current_video) return // return if we're not playing
		this.emit("stop", this.current_video)
		// stream next video
		if (this.queue.length > 0) // if we have demands for next
			this.playQueue()
		else if (this.conf.auto_play && this.current_video) { // else if auto play is enabled, search for related
			this.getRelated(this.current_video.id)
				.then(video => this.play(video.id.videoId))
		} else {
			this.stop()
			this.emit('message', "Empty queue. Enable auto play to play related videos automatically.")
		}
	}
	previous() {
		if (this.last_video) this.play(this.last_video.id)
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
		if (this.current_video) {
			if (this.player.seekable) {
				time = fromHumanTime(time) / 1000.0
				logger.info("Seeking " + time)
				this.player.seek(time)
			}
			else this.emit("message", "This video is not seekable")
		}
	}
	jumpForward(distance = this.conf.jump_distance) {
		const current = this.player.currentTime * 1000
		this.seek(current + distance)
	}
	jumpBackward(distance = this.conf.jump_distance) {
		const current = this.player.currentTime * 1000
		this.seek(current - distance)
	}
	get related() {
		if (!this.current_video) return []
		return (async () => {
			const related = promisify(ytapi().related)
			const vids = await related(this.current_video.id, 15)
			return vids.items.map(e => e.id.videoId)
		})()
	}
	getRelated(id) {
		const link = utils.video_link(id)
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
	async mostPopular(regionCode = this.lang, videoCategoryId = 10, maxResults = 25) {
		logger.log("Retrieving most popular videos from category " + videoCategoryId + " and country code " + regionCode)
		const api = ytapi({
			part: "id",
			chart: "mostPopular",
			videoCategoryId,
			maxResults,
			regionCode
		})

		const url = api.getUrl('videos')
		const req = promisify(api.request.bind(api))
		const res = await req(url)
		return res
	}
}
module.exports = YoutubePlayer