const promisify = require('util').promisify

const utils = require('lib/utils')
const logger = require('lib/logger')('youtube:playlist')

module.exports = {
	handle: "youtube::playlist",
	needs: ["database", "youtube::info"],
	init: stumble => {
		const db = stumble.execute('database::use')

		const playlist_table = "youtube_playlist"
		const playlist_content_table = "youtube_playlist_content"
		stumble.space.set("youtube::database::playlist_table", playlist_table)
		stumble.space.set("youtube::database::playlist_content_table", playlist_content_table)
		const run = promisify(db.run.bind(db))
		run('PRAGMA foreign_keys = ON;')
			.then(a => run(`
			CREATE TABLE IF NOT EXISTS ${playlist_table} (
				id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
				name TEXT NOT NULL UNIQUE
			);`))
			.then(() => run(`
			CREATE TABLE IF NOT EXISTS ${playlist_content_table} (
				videoId VARCHAR(11) NOT NULL,
				playlistId INTEGER NOT NULL,
				PRIMARY KEY (videoId, playlistId),
				FOREIGN KEY(playlistId)
					REFERENCES ${playlist_table} (id)
					ON DELETE CASCADE
					ON UPDATE CASCADE
			);`))
			.catch(err => logger.error(err))
	},
	commands: [{
		handle: "createList",
		exec: function (data) {
			const name = data.message
			if (typeof name !== "string" || name.length <= 0) return

			const stumble = this

			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const sql = `
				INSERT INTO ${playlist_table} (name) VALUES ("${name}")
			`
			const db = stumble.execute('database::use')
			db.run(sql, function (err) {
				if (err) return logger.error(err)
				stumble.client.user.channel.sendMessage("Playlist <b>" + name + "</b> successfully created.")
			})
		}
	}, {
		handle: "addTo",
		exec: function (data) {
			const name = data.message
			if (typeof name !== "string" || name.length <= 0) return

			const stumble = this
			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const playlist_content_table = stumble.space.get("youtube::database::playlist_content_table")
			const player = stumble.space.get("youtube-player")
			const video = player.current_video
			// logger.log(video)
			const sql = `
				INSERT INTO ${playlist_content_table} (videoId, playlistId)
				SELECT "${video.id}", id 
				FROM ${playlist_table} WHERE name = "${name}"
			`
			const db = stumble.execute('database::use')
			db.run(sql, function (err) {
				if (err) return logger.error(err)
				stumble.client.user.channel.sendMessage("<b>" + video.snippet.title + "</b> was successfully added to playlist <b>" + name + "</b>.")
			})
		}
	}, {
		handle: "displayList",
		exec: function (data) {
			const name = data.message
			if (typeof name !== "string" || name.length <= 0) return


			const stumble = this
			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const playlist_content_table = stumble.space.get("youtube::database::playlist_content_table")
			const db = stumble.execute('database::use')
			const sql = `
				SELECT videoId
				FROM ${playlist_content_table}, ${playlist_table}
				WHERE ${playlist_table}.id = ${playlist_content_table}.playlistId AND ${playlist_table}.name = "${name}"
			`
			const dbAll = promisify(db.all.bind(db))
			dbAll(sql)
				.then(rows => {
					const ids = rows.map(({ videoId }) => videoId)
					return this.execute('youtube::info::displayVideoList', ids)
				}).catch(err => logger.error(err))

		}
	}, {
		handle: "deleteList",
		exec: function (data) {
			const name = data.message
			if (typeof name !== "string" || name.length <= 0) return


			const stumble = this
			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const playlist_content_table = stumble.space.get("youtube::database::playlist_content_table")
			const db = stumble.execute('database::use')
			const sql = `
				DELETE FROM ${playlist_table}
				WHERE name = "${name}"
			`
			db.run(sql, function (err) {
				if (err) return logger.error(err)
				stumble.client.user.channel.sendMessage("Playlist <b>" + name + "</b> erased.")
			})
		}
	}, {
		handle: "playList",
		exec: async function (data) {
			try {
				const name = data.message
				if (typeof name !== "string" || name.length <= 0) return
				const player = this.space.get("youtube-player")
				let ids = await this.execute('youtube::playlist::dynamic::' + name) // try to fetch ids from dynamic playlist
				if (!(ids && ids.length)) {
					const playlist_table = this.space.get("youtube::database::playlist_table")
					const playlist_content_table = this.space.get("youtube::database::playlist_content_table")
					const db = this.execute('database::use')

					const sql = `SELECT videoId
								FROM ${playlist_content_table}, ${playlist_table}
								WHERE ${playlist_table}.id = ${playlist_content_table}.playlistId AND ${playlist_table}.name = "${name}";`
					const dbAll = promisify(db.all.bind(db))
					const rows = await dbAll(sql)
					ids = rows.map(({ videoId }) => videoId)
				}
				utils.shuffle(ids)
				this.execute('youtube::info::displayVideoList', ids.slice(0))
				player.queue = ids
				player.playQueue()
			} catch (err) {
				logger.error(err)
			}
		}
	}, {
		handle: "removeFrom",
		exec: function (data) {
			const name = data.message
			if (typeof name !== "string" || name.length <= 0) return

			const stumble = this
			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const playlist_content_table = stumble.space.get("youtube::database::playlist_content_table")
			const db = stumble.execute('database::use')

			const video = stumble.space.get('youtube-player').current_video
			const sql = `
				DELETE FROM ${playlist_content_table}
				WHERE videoId = "${video.id}" 
				AND playlistId = (SELECT id
								FROM ${playlist_table} 
								WHERE name = "${name}");`

			const run = promisify(db.run.bind(db))
			run(sql)
				.then(() => {
					stumble.client.user.channel.sendMessage("Video <b>" + video.snippet.title + "</b> removed from playlist <b>" + name + "</b>.")
				})
				.catch(err => logger.error(err))
		}
	}, {
		handle: "playlists",
		exec: function (data) {
			const stumble = this
			const playlist_table = stumble.space.get("youtube::database::playlist_table")
			const playlist_content_table = stumble.space.get("youtube::database::playlist_content_table")
			const db = stumble.execute('database::use')

			const sql = `
				SELECT name, COUNT(videoId) AS n
				FROM ${playlist_content_table}, ${playlist_table}
				WHERE playlistId = id
				GROUP BY playlistId;`
			const dbAll = promisify(db.all.bind(db))
			dbAll(sql)
				.then(rows => {
					let message = "Playlists:" + utils.breakTag
					let i = 1
					rows.forEach(({ name, n }) => message += i++ + ". " + name + " (" + n + ")" + utils.breakTag)
					utils.autoPartsString(message, 50000, utils.breakTag).forEach(m => this.client.user.channel.sendMessage(m))
				})
				.catch(err => logger.error(err))
		}
	}]
}