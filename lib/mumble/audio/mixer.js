const Stream = require('stream')
const fs = require('fs')
const logger = require('lib/logger')('mixer')

function mixSamples(samples) {
	const length = samples.length
	const ratio = 1 / length
	let mixed = 0;
	for (let i = 0; i < length; i++) mixed += samples[i] * ratio
	return mixed
	// return samples.reduce((a, s) => Math.max(Math.min(s / length + a, 32767), -32768), 0)
}
// chunks MUST have the same size
function mixChunks(chunks, sampleByteLength) {
	const length = chunks[0].length
	const mixed = chunks[0]
	const l = chunks.length
	const samples = new Array(l)
	for (let offset = 0; offset < length; offset += sampleByteLength) {
		//chunks.map(chunk => mixed.readInt16LE.call(chunk, offset))
		for (let i = 0; i < l; i++) samples[i] = chunks[i].readInt16LE(offset)
		mixed.writeInt16LE(mixSamples(samples), offset)
	}
	return mixed
}
// inspired by https://github.com/stephen/audio-mixer
class Input extends Stream.Writable {
	constructor(options) {
		super(options)
		options = Object.assign({
			bitDepth: 16,
			channels: 1,
			volume: 1
		}, options)
		this.bitDepth = options.bitDepth
		this.channels = options.channels
		this.volume = options.volume

		this.getMoreData = null
		this.buffer = Buffer.alloc(0)
		this.finished = false
		this.once('finish', () => {
			this.finished = true
			if (this.buffer.length === 0) this.emit('end')
			else this.once('flushed', () => this.emit('end'))
		})
	}
	read(samples) {
		let bytes = samples * this.sampleLength
		if (this.buffer.length < bytes) bytes = this.buffer.length

		let r = this.buffer.slice(0, bytes)
		this.buffer = this.buffer.slice(bytes)

		if (this.buffer.length <= 131072 && this.getMoreData) {
			const getMoreData = this.getMoreData
			this.getMoreData = null
			process.nextTick(getMoreData)
		}
		if (this.buffer.length === 0) this.emit('flushed')
		return r
	}
	availSamples(length = this.buffer.length) {
		return Math.floor(length / this.sampleLength)
	}
	_write(chunk, encoding, callback) {
		this.buffer = Buffer.concat([this.buffer, chunk])
		this.emit('readable')
		if (this.buffer.length > 131072)
			this.getMoreData = callback
		else
			callback()

	}
	get sampleLength() {
		return this.bitDepth / 8 * this.channels
	}
}
class MixerSlow extends Stream.Readable {
	constructor(options) {
		super(options)
		options = Object.assign({
			bitDepth: 16,
			channels: 1,
			volume: 1
		}, options)
		this.bitDepth = options.bitDepth
		this.channels = options.channels
		this.sampleByteLength = this.bitDepth / 8

		this.buffer = Buffer.alloc(0)
		this.inputs = {}
		this.retry = null
	}

	_read() {
		this.retry = null
		let samples = Number.MAX_VALUE
		const keys = Object.keys(this.inputs)
		const keyslenth = keys.length
		for (let i = 0; i < keyslenth; i++) {
			const availSamples = this.inputs[keys[i]].availSamples()
			if (availSamples < samples) samples = availSamples
		}
		if (samples > 0 && samples != Number.MAX_VALUE) {
			const chunks = []
			for (let i = 0; i < keyslenth; i++) {
				chunks.push(this.inputs[keys[i]].read(samples))
				// Object.keys(this.inputs).map(id => this.inputs[id].read(samples))
			}
			const mixedBuffer = mixChunks(chunks, this.sampleByteLength)
			this.push(mixedBuffer)
		} else {
			this.retry = this._read.bind(this)
		}
	}
	plug(stream, options) {
		const id = Math.random().toString(36).substr(7)
		const input = new Input(options)
		input.on('readable', () => this.retry && this.retry())
		input.on('end', () => this.unplug(id))
		stream.pipe(input)
		this.inputs[id] = input
		if (this.retry) process.nextTick(this.retry.bind(this))
		return id
	}
	unplug(id) {
		const input = this.inputs[id]
		input.removeAllListeners()
		delete this.inputs[id]
		if (this.retry) process.nextTick(this.retry.bind(this))
		this.emit('unplug', id)
	}
}

class Mixer2 extends Stream.Transform {
	constructor(options) {
		super()
		this.retry = null
		this.input = null
		this.sampleByteLength = 2
		this.count = 0
		this.lastUpdate = Date.now()
		setInterval(() => {
			const now = Date.now()
			const time = now - this.lastUpdate
			this.lastUpdate = now
			if (!this.count) return
			const rate = this.count / time
			this.count = 0
			// logger.info("Rate: " + rate.toFixed(2) + " bytes/s")
		}, 2000)
		this.on('pipe', () => this.piped = true)
		this.on('unpipe', () => { this.piped = false })
	}
	_transform(chunk, encoding, callback) {
		// return callback(null, chunk)
		this.retry = null
		const sampleAvailable = Math.min(this.input ? this.input.availSamples() : Number.MAX_VALUE, chunk.length / this.sampleByteLength)
		if (this.input && sampleAvailable > 0) {
			const bytes = sampleAvailable * this.sampleByteLength
			const newBuf = mixChunks([this.input.read(sampleAvailable), chunk.slice(0, bytes)], this.sampleByteLength)
			this.push(newBuf)
			this.count += bytes
			chunk = chunk.slice(bytes)
			if (chunk.length) {
				this.retry = () => this._transform(chunk, encoding, callback)
				this.input ? this.input.once('readable', () => this.retry && this.retry()) : this.retry()
			}
			else callback()
		} else {
			this.count += chunk.length
			if (this.input) logger.log(this.input.availSamples())
			// else logger.log('no input')
			callback(null, chunk)

		}

	}
	plug(stream) {
		if (this.piped) {
			this.input = new Input()
			stream.pipe(this.input)
			this.input.once('end', () => this.input = null && this.retry && this.retry())
		} else {
			stream.pipe(this, { end: false })
			stream.on("end", () => stream.unpipe())
		}
	}
}

module.exports = Mixer2
function main() {
	let m = new module.exports
	let s1 = fs.createReadStream('data/voice/1.wav')
	let s2 = fs.createReadStream('data/voice/2.wav')

	const input = new Input()
	m.input = input
	s2.pipe(input)
	s1.pipe(m)
	m.pipe(fs.createWriteStream('data/voice/test.wav'))

	// setTimeout(() => { }, 5000)
}

// main()