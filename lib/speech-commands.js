const s = require('./stumble-instance.js')
const logger = require('./logger.js')('SpeechCommands')
const {
    BreakException
} = require('./utils.js')
const commands = {
	volume: {
		detector: /(?:.* )?volume +(\d+)/i,
		func: (matches, tr) => {
			let vol = parseInt(matches[1], 10) / 1000
			s.config.extensions.audio.gain = vol
			if (s.space.get('audio.streaming'))
				s.space.set('audio.streaming', vol)
			if (s.io.input)
				s.io.input.setGain(vol)

			s.execute("info::gain")
		}
	},
	stop: {
		detector: /(.* )?(?:(ferme (la)?)?ta gueule?)|(?:stop)/i,
		func: (matches, tr) => {
			s.invoke('stop')
		}
	},
	next: {
		detector: /(.* )?(?:(?:jeanne)|(?:jane)|(?:je))? ?(?:(?:met?)|(?:mai)[a-z]{0,3}) ?(la)? ?(suivante?s?)|(next?)/i,
		func: (matches, tr) => {
			s.invoke('next')
		}
	},
	play: {
		detector: /je (?:(?:met?s?)|(?:mai)[a-z]{0,3}) (.+)/i,
		func: (matches, tr) => {
			let terms = matches.slice(1).join(' ')
			logger.log("Setting video/song: " + terms)

			s.invoke('stop')
			s.invoke('yt', {
				message: terms
			})
		}
	},
	reboot: {
		detector: /(.* )?(reboot)|(redemarrer)/i,
		func: (matches, tr) => {
			s.invoke('reboot')
		}
	},
	volumedown: {
		detector: /(baisse (le son))|(moins fort)/i,
		func: (matches, tr) => {
			s.invoke("volumedown")
		}
	},
	volumeup: {
		detector: /(monte (le son))|(plus fort)/i,
		func: (matches, tr) => {
			s.invoke("volumeup")
		}
	},
	addnext: {
		detector: /pre|épare? (.+)/i,
		func: (matches, tr) => {
			s.invoke("addnext", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	add: {
		detector: /ajoute? (.+)/i,
		func: (matches, tr) => {
			s.invoke("add", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	mute: {
		detector: /(mute)|(muett?e?)/i,
		func: (matches, tr) => {
			s.invoke("mute")
		}
	},
	radio: {
		detector: /radio (.+)/i,
		func: (matches, tr) => {
			s.invoke("radio", {
				message: matches.slice(1).join(' ')
			})
		}
	},
	pause: {
		detector: /(pause)|(pose)/i,
		func: (matches, tr) => {
			s.invoke("pause")
		}
	},
	resume: {
		detector: /(play)|(lecture)/i,
		func: (matches, tr) => {
			s.invoke("play")
		}
	},
	search: {
		detector: /(?:re)?(?:cherche) (.+)/i,
		func: (matches, tr) => {
			let terms = matches.slice(1).join(' ')
			s.invoke("search", {
				message: terms
			})
		}
	},
	description: {
		detector: /description/i,
		func: (matches, tr) => {
			s.invoke("description")
		}
	},
	move_forward: {
		detector: /avance/i,
		func: (matches, tr) => {			
			const player = s.space.get('youtube-player')
			player.jumpForward()
		}
	},
	move_backward: {
		detector: /recule/i,
		func: (matches, tr) => {			
			const player = s.space.get('youtube-player')
			player.jumpBackward()
		}
	},
	history: {
		detector: /historique/i,
		func: (matches, tr) => {
			s.invoke("history")
		}
	},
	hits: {
		detector: /(vidéos?)? ?(les )?plus écoutée?s?/i,
		func: (matches, tr) => {
			s.invoke("hits")
		}
	}
}

module.exports = commands
