const util = require('util')
const utils = require("../utils.js")
const logger = require('../logger.js')("notepad")

const breakTag = "<br>"
const notepad = {
	handle: "notepad",
	init: async stumble => {
		const db = stumble.execute('database::use')
		const notepad_table = "notepad"
		stumble.space.set("notepad::notepad_table", notepad_table)

		const run = util.promisify(db.run.bind(db))
		await run(`
			CREATE TABLE IF NOT EXISTS ${notepad_table} (
				id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
				content TEXT NOT NULL
			);`)
	},
	commands: [{
		handle: "note",
		exec: async function (data) {
			const note = data.message.trim()
			if (note.length > 0) {
				const db = this.execute('database::use')
				const table = this.space.get("notepad::notepad_table")
				const run = util.promisify(db.run.bind(db))
				const sql = `INSERT INTO ${table}(content) VALUES($note);`
				// logger.info("Adding note: ", sql)
				try {
					await run(sql, { $note: note })
					this.client.user.channel.sendMessage("Note added.")
				} catch (e) {
					logger.error(e)
				}
			}
		}
	}, {
		handle: "dispNote",
		exec: async function (data) {
			let filter = data.message
			const db = this.execute('database::use')
			const table = this.space.get("notepad::notepad_table")
			const dbAll = util.promisify(db.all.bind(db))
			let sql = `SELECT id, content FROM ${table}`
			// logger.info(sql)
			try {
				let rows = await dbAll(sql)
				if (filter.length > 0) {
					filter += ":"
					const len = filter.length
					rows = rows.filter(r => r.content.startsWith(filter))
						.map(r => (r.content = r.content.slice(len).trim(), r))
				}
				// logger.info(rows)
				let message = "Notes: " + breakTag
				rows.forEach(r => {
					message += r.id + ". " + r.content + breakTag
				})
				utils.autoPartsString(message, 50000, breakTag).forEach(m => this.client.user.channel.sendMessage(m))
			} catch (e) {
				logger.error(e)
			}

		}
	}, {
		handle: "rmNote",
		exec: async function (data) {
			const id = parseInt(data.message)
			if (!isNaN(id) && id > 0) {
				try {
					const db = this.execute('database::use')
					const table = this.space.get("notepad::notepad_table")
					const run = util.promisify(db.run.bind(db))
					const sql = `DELETE FROM ${table} WHERE id = $id;`
					await run(sql, { $id: id })
					this.client.user.channel.sendMessage("Note removed.")
				} catch (e) {
					logger.error(e)
				}
			}
		}
	}]
}
module.exports = notepad