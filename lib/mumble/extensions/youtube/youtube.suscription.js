const promisify = require('util').promisify

const logger = require('lib/logger')('youtube:subscription')
const utils = require('lib/utils')
const ytapi = require('lib/model/youtube/youtube.api')
const google = require('googleapis');
const youtube = google.youtube('v3');
const parse = require('parse-youtube-user')
const cheerio = require('cheerio')

const API_KEY = require('keys/api-keys.json').youtube;

const listActivities = promisify(youtube.activities.list)
const listChannels = promisify(youtube.channels.list)

module.exports = {
	handle: 'youtube::subscription',
	needs: ['database', 'info'],
	init: async stumble => {
		try {
			const db = stumble.execute('database::use')
			const subscriptions_table = "youtube_subscriptions"
			stumble.space.set("youtube::database::subscriptions_table", subscriptions_table)
			const run = promisify(db.run.bind(db))
			await run('PRAGMA foreign_keys = ON;')
			await run(`CREATE TABLE IF NOT EXISTS ${subscriptions_table} (
				id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
				channelId TEXT NOT NULL UNIQUE,
				title TEXT NOT NULL);`)
		}
		catch (err) {
			logger.log(err);
		}

	},
	commands:
	[{
		handle: 'subscribe',
		exec: async function (data) {
			try {
				let links = []
				cheerio.load(data.message)('a').each((_, el) => {
					const attr = el.attribs['href']
					if (attr) links.push(attr)
				})
				const givenId = parse(links.length > 0 ? links[0] : data.message)
				const isId = /^UC[a-zA-Z0-9_-]{1,}$/.test(givenId)

				if (givenId.length === 0) {
					this.client.user.channel.sendMessage('You must supply a channel link or id')
					throw new Error("Invalid argument")
				}
				const params = {
					key: API_KEY,
					part: 'id,snippet'
				}
				if (isId) {
					params.id = givenId
				} else {
					params.forUsername = givenId
				}
				const result = (await listChannels(params)).items[0]
				if (result) {
					const id = result.id
					const title = result.snippet.title

					const table = this.space.get('youtube::database::subscriptions_table')
					const db = this.execute('database::use')
					const run = promisify(db.run.bind(db))
					await run(`INSERT INTO ${table}(channelId, title) VALUES('${id}', '${title}')`)
					this.client.user.channel.sendMessage('Subscription added: ' + title)
				}

			} catch (e) {
				logger.error(e);
			}
		},
		info: () => `Subscribe to the given youtube channel`
	}, {
		handle: 'subscriptions',
		exec: async function (data) {
			try {
				const table = this.space.get('youtube::database::subscriptions_table')
				const db = this.execute('database::use')
				const all = promisify(db.all.bind(db))
				const result = await all(`SELECT channelId,title FROM ${table}`)

				let message = '<ul>'
				result.forEach(r => {
					const link = 'https://www.youtube.com/channel/' + r.channelId
					message += '<li>' + utils.link_with_title(link, r.title) + '</li>'
				})
				message += '</ul>'

				utils.autoPartsString(message, 50000, utils.breakTag).forEach(m => this.client.user.channel.sendMessage(m))
			} catch (e) {
				logger.error(e)
			}
		},
		info: () => `Display the list of subscriptions`
	}, {
		handle: 'unsubscribe',
		exec: async function (data) {
			try {
				const table = this.space.get('youtube::database::subscriptions_table')
				const db = this.execute('database::use')
				const run = promisify(db.run.bind(db))
				if (!(data.message && data.message.length > 0)) {
					this.client.user.channel.sendMessage('You must supply a channel link or id')
					throw new Error("Invalid argument")
				}
				await run(`DELETE FROM ${table} WHERE title = '${data.message}';`)
				this.client.user.channel.sendMessage('Subscription to ' + data.message + ' successfully removed')
			} catch (e) {
				logger.error(e)
			}
		},
		info: () => `Remove the subscription to the given channel`
	}],
	extensions: [{
		handle: 'youtube::playlist::dynamic::news',
		exec: async function (data) {
			try {
				const table = this.space.get('youtube::database::subscriptions_table')
				const db = this.execute('database::use')
				const all = promisify(db.all.bind(db))
				const ids = (await all(`SELECT channelId FROM ${table};`)).map(e => e.channelId)
				const videos = []
				for (let i = 0; i < ids.length; i++) {
					const channelId = ids[i];
					const activities = (await listActivities({
						key: API_KEY,
						part: 'contentDetails',
						maxResults: 50,
						channelId
					})).items.filter(i => 'upload' in i.contentDetails).map(e => e.contentDetails.upload.videoId).slice(0, this.config.extensions.youtube.subscription_max_videos)
					videos.push(...activities);
				}
				return videos
			} catch (e) {
				logger.error(e)
			}
		},
		info: () => `Show new videos of subscribed channels`
	}]
}