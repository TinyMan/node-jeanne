const promisify = require('util').promisify
require('autolink-js')

const logger = require('lib/logger')('youtube:info')
const utils = require('lib/utils')
const ytapi = require('lib/model/youtube/youtube.api')

module.exports = {
	handle: "youtube::info",
	needs: ["database"],
	init: stumble => {
		const player = stumble.space.get('youtube-player')
		player.on('play', v => stumble.execute("youtube::info::playing", v))
		player.on('add', v => stumble.execute("youtube::info::added", v))
		player.on('addnext', v => stumble.execute("youtube::info::next", v))
		player.on('message', m => stumble.client.user.channel.sendMessage(m))

		const db = stumble.execute('database::use')
		const history_table = "youtube_history"
		stumble.space.set("youtube::database::history_table", history_table)
		db.run(`
			CREATE TABLE IF NOT EXISTS ${history_table} (
				id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				videoId VARCHAR(11) NOT NULL,
				timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
			);
		`, function (err) {
				if (err) return logger.error(err)
			})
		player.on('play', v => {
			const timeout = setTimeout(registerHistory, 40000) // 40sec
			function cancel() {
				clearTimeout(timeout);
			}
			function registerHistory() {
				if (v.id !== player.current_video.id) return
				player.removeListener("stop", cancel);
				db.run(`INSERT INTO ${history_table}(videoId) VALUES($videoId);`, { $videoId: v.id }, function (err) {
					if (err) return logger.error(err)
				})
			}
			player.once("stop", cancel)
		})
	},
	extensions: [{
		handle: "youtube::info::playing",
		exec: function (video) {
			const id = video.id
			const link = utils.video_link(id)
			let message = "Now playing: <b>" + utils.link_with_title(link, video.snippet.title) + "</b> (" + utils.convertISO8601ToSring(video.contentDetails.duration) + ")"
			this.client.user.channel.sendMessage(message)
		}
	},
	{
		handle: "youtube::info::description",
		exec: function (video) {
			const id = video.id
			const link = utils.video_link(id)
			let message = "<b>" + utils.link_with_title(link, video.snippet.title) + "</b> (" + utils.convertISO8601ToSring(video.contentDetails.duration) + ")" + utils.breakTag
			const date = new Date(video.snippet.publishedAt)
			message += "<b>Publish Date:</b> " + `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` + " - <b>View count: </b>" + video.statistics.viewCount.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + utils.breakTag
			message += video.snippet.description.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)+/g, '$1' + utils.breakTag + '$2').autoLink()
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
			let message = "La video <b>" + terms + "</b> a été ajoutée à la file d'attente."
			this.client.user.channel.sendMessage(message)
		}
	},
	{
		handle: "youtube::info::displayVideoList",
		exec: function (ids) {
			const videos = {}
			const getById = promisify(ytapi().getById)
			const stumble = this
			let n = 1;
			return getById(ids.join(','))
				.then(res => {
					let message = ""
					res.items.forEach(v => {
						videos[v.id] = v
					})
					ids.forEach(id => {
						const video = videos[id]
						const link = utils.video_link(id)
						message += n++ + ". <b>" + utils.link_with_title(link, video.snippet.title) + "</b> (" + utils.convertISO8601ToSring(video.contentDetails.duration) + ")" + utils.breakTag
					})
					utils.autoPartsString(message, 50000, utils.breakTag).forEach(m => stumble.client.user.channel.sendMessage(m))
				})
				.catch(err => logger.error(err))
		}
	}],
	commands: [{
		handle: "history",
		exec: function () {
			const stumble = this
			const history_table = stumble.space.get('youtube::database::history_table')
			const db = stumble.execute("database::use")
			const dbAll = promisify(db.all.bind(db))
			dbAll(`
				SELECT videoId
				FROM ${history_table}
				ORDER BY id DESC
				LIMIT 30;
			`)
				.then(rows => {
					const ids = rows.map(({ videoId }) => videoId)
					return this.execute('youtube::info::displayVideoList', ids)
				})
				.catch(err => logger.error(err))
		}
	}, {
		handle: "hits",
		exec: function () {
			const stumble = this
			const history_table = stumble.space.get('youtube::database::history_table')
			const db = stumble.execute("database::use")
			const dbAll = promisify(db.all.bind(db))
			dbAll(`
				SELECT videoId, count(videoId)
				FROM ${history_table}
				GROUP BY videoId
				ORDER BY count(videoId) DESC
				LIMIT 20;
			`)
				.then(rows => {
					const ids = rows.map(({ videoId }) => videoId)
					return this.execute('youtube::info::displayVideoList', ids)
				})
				.catch(err => logger.error(err))
		}
	}]
}