const EventEmitter = require('events').EventEmitter
const minmax = require('stumble/lib/gutil').minmax
const ffmpeg = require('fluent-ffmpeg')
const TimedStream = require("timed-stream")
const logger = require('./logger.js')('Streamer')
const samples = 48000

class Streamer extends EventEmitter {

	constructor(stumble) {
		super()
		this.stumble = stumble
		this.current_stream = null
		this._convert_command = null
		this.passthrough = null
		this.streaming = false
	}
	stream(s) {
		// stream an audio stream (and convert it) through stumble input
		if (this.streaming) return // already streaming

		this.current_stream = s
		this.start()
	}
	start() {
		this.streaming = true

		this._convert_command = ffmpeg()
		if (this.current_stream) this._convert_command.input(this.current_stream)
		if (this._additionnalInput) this._convert_command.input(this._additionnalInput)
		this._convert_command.withAudioFrequency(this.stumble.io.input.sampleRate)
			.withAudioChannels(this.stumble.io.input.channels)
			.format('s16le')
			.on('error', function (err, stdout, stderr) {
				// logger.log('an error happened: ', err)
				// logger.log("ffmpeg stdout:\n" + stdout)
				// logger.log("ffmpeg stderr:\n" + stderr)
			})

		this.passthrough = new TimedStream({
			rate: this.stumble.io.input.sampleRate * this.stumble.io.input.channels * this.stumble.io.input.bitDepth / 8, // bytes rate per second
		})
		this.passthrough.on('end', e => {
			// natural end
			this.emit('end')
		})
		this.passthrough.on('error', e => {
			logger.log("Passthrough error", e)
		})
		this.passthrough.on('kill', e => {
			logger.log("Passthrough kill", e)
		})
		this.passthrough.on('close', e => {
			logger.log("Passthrough close", e)
		})
		this._convert_command.pipe(this.passthrough)
		this.stumble.space.get('mixer').plug(this.passthrough)
	}
	stop() {
		if (!this.streaming) return
		this.streaming = false
		// stop the current stream
		if (this._convert_command) {
			this._convert_command.kill()
			this._convert_command = null
		}
		if (this.current_stream) {
			this.current_stream.unpipe()
			this.current_stream = null
		}
		if (this.passthrough) {
			this.passthrough.unpipe()
			this.passthrough.destroy && this.passthrough.destroy()
			this.passthrough = null
		}
		clearInterval(this.interval)
	}

	pause() {
		this.passthrough.pauseStream()
	}
	resume() {
		this.passthrough.resumeStream()
	}
	clear() {

	}
}

module.exports = Streamer
