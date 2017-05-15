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
	stream(s, begin = 0) {
		// stream an audio stream (and convert it) through stumble input
		if (this.streaming) return // already streaming

		if (!this.stumble.io.input) {
			this.stumble.io.establish({
				input: true,
				inputOptions: {
					channels: 2,
					sampleRate: samples,
					gain: minmax(0.01, this.stumble.config.extensions.audio.gain, 1.0)
				}
			})
		}
		this.current_stream = s
		this.streaming = true

		this._convert_command = ffmpeg(s)
			.seekInput(begin)
			.withAudioFrequency(this.stumble.io.input.sampleRate)
			.withAudioChannels(this.stumble.io.input.channels)
			.format('s16le')
			.on('error', function (err, stdout, stderr) {
				// logger.log('an error happened: ', err)
				// logger.log("ffmpeg stdout:\n" + stdout)
				// logger.log("ffmpeg stderr:\n" + stderr)
			})

		this.passthrough = new TimedStream({
			rate: this.stumble.io.input.sampleRate * this.stumble.io.input.channels * (16 / 8),
			period: 100
		}) //new Stream.PassThrough()

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
		this.passthrough.pipe(this.stumble.io.input, {
			end: false // keep stumble input open
		})
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
			this.passthrough.destroy()
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
