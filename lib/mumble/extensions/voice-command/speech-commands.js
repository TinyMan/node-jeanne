const s = require('lib/mumble/stumble-instance.js')
const logger = require('lib/logger.js')('speech-commands')
const between = (a, b, c) => c < a ? a : (c > b ? b : c)
const { BreakException } = require('lib/utils.js')
const commands = {
	volume: {
		detector: /(?:.* )?volume +(\d+)/i,
		func: function (matches, tr) {
			let vol = parseFloat(matches[1], 10) / 100.0
			vol = between(0, 1, vol)
			this.config.extensions.audio.gain = vol
			if (this.io.input)
				this.io.input.setGain(vol)

			this.execute("info::gain")
		}
	},
	stop: {
		detector: /(.* )?(?:(ferme (la)?)?ta gueule?)|(?:stop)/i,
		func: function (matches, tr) {
			this.invoke('stop')
		}
	},
	next: {
		detector: /(.* )?(?:(?:met?)|(?:mai)[a-z]{0,3})? ?(la)? ?(suivante?s?)|(next?)/i,
		func: function (matches, tr) {
			this.invoke('next')
		}
	},
	play: {
		detector: /je (?:(?:met?s?)|(?:mai)[a-z]{0,3}) (.+)/i,
		func: function (matches, tr) {
			let terms = matches.slice(1).join(' ')
			logger.log("Setting video/song: " + terms)
			this.invoke('yt', {
				message: terms
			})
		}
	},
	reboot: {
		detector: /(.* )?(reboot)|(redémarrer?)/i,
		func: function (matches, tr) {
			this.invoke('reboot')
		}
	},
	volumedown: {
		detector: /(baisse (le son))|(moins fort)/i,
		func: function (matches, tr) {
			this.invoke("volumedown")
		}
	},
	volumeup: {
		detector: /(monte (le son))|(plus fort)/i,
		func: function (matches, tr) {
			this.invoke("volumeup")
		}
	},
	addnext: {
		detector: /pre|épare? (.+)/i,
		func: function (matches, tr) {
			this.invoke("addnext", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	add: {
		detector: /ajoute? (.+)/i,
		func: function (matches, tr) {
			this.invoke("add", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	mute: {
		detector: /(mute)|(muett?e?)/i,
		func: function (matches, tr) {
			this.invoke("mute")
		}
	},
	radio: {
		detector: /radio (.+)/i,
		func: function (matches, tr) {
			this.invoke("radio", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	playlist: {
		detector: /play ?list (.+)/i,
		func: function (matches, tr) {
			const terms = matches[1]
			logger.log("Playing playlist: " + terms)
			this.invoke('playList', {
				message: terms
			})
		}
	},
	playlists: {
		detector: /affiche les play ?lists?/i,
		func: function (matches, tr) {
			this.invoke('playlists')
		}
	},
	pause: {
		detector: /(pause)|(pose)/i,
		func: function (matches, tr) {
			this.invoke("pause")
		}
	},
	resume: {
		detector: /(play)|(lecture)/i,
		func: function (matches, tr) {
			this.invoke("play")
		}
	},
	search: {
		detector: /(?:re)?(?:cherche) (.+)/i,
		func: function (matches, tr) {
			let terms = matches.slice(1).join(' ')
			this.invoke("search", {
				message: terms
			})
		}
	},
	description: {
		detector: /description/i,
		func: function (matches, tr) {
			this.invoke("description")
		}
	},
	move_forward: {
		detector: /avance/i,
		func: function (matches, tr) {
			const player = this.space.get('youtube-player')
			player.jumpForward()
		}
	},
	move_backward: {
		detector: /recule/i,
		func: function (matches, tr) {
			const player = this.space.get('youtube-player')
			player.jumpBackward()
		}
	},
	history: {
		detector: /historique/i,
		func: function (matches, tr) {
			this.invoke("history")
		}
	},
	hits: {
		detector: /(vidéos?)? ?(les )?plus écoutée?s?/i,
		func: function (matches, tr) {
			this.invoke("hits")
		}
	},
	trending: {
		detector: /(trending)|(tendances?)/i,
		func: function (matches, tr) {
			this.invoke("playList", { message: 'trending' })
		}
	},
	previous: {
		detector: /précédente?/,
		func: function (matches, tr) {
			this.invoke('previous')
		}
	},
	related: {
		detector: /propositions?/,
		func: function (matches, tr) {
			this.invoke('related')
		}
	},
	news: {
		detector: /(news?)|(nouveautés?)/i,
		func: function (matches, tr) {
			this.invoke("playList", { message: 'news' })
		}
	}
}

module.exports = commands
