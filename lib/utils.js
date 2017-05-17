class BreakException {
	constructor(command, transcript) {
		this.command = command
		this.transcript = transcript
	}
}

function min(a, b) {
	return a < b ? a : b
}

function max(a, b) {
	return a > b ? a : b
}

function youtube_parser(url) {
	var ID = ''
	url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/)
	if (url[2] !== undefined) {
		ID = url[2].split(/[^0-9a-z_\-]/i)
		ID = ID[0]
	} else {
		ID = url
	}
	return ID
}

function convertISO8601ToSring(input) {
	const dur = convertISO8601ToObject(input)
	let str = ""
	if (dur.hours > 0) {
		if (str.length > 0 && dur.hours < 10) str += "0"
		str += dur.hours + ":"
	}
	if (dur.minutes < 10) str += "0"
	str += dur.minutes + ":"

	if (dur.seconds < 10) str += "0"
	str += dur.seconds
	return str
}

function convertISO8601ToSeconds(input) {
	return convertISO8601ToObject(input).totalseconds
}

function convertISO8601ToObject(input) {
	var reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
	var hours = 0,
		minutes = 0,
		seconds = 0,
		totalseconds

	if (reptms.test(input)) {
		var matches = reptms.exec(input)
		if (matches[1]) hours = Number(matches[1])
		if (matches[2]) minutes = Number(matches[2])
		if (matches[3]) seconds = Number(matches[3])
		totalseconds = hours * 3600 + minutes * 60 + seconds
	}

	return {
		hours,
		minutes,
		seconds,
		totalseconds
	}
}

/**
 * Parts a string into substrings of max length maxLength using separator sep
 * 
 * @param {string} string 
 * @param {number} maxLength 
 * @param {string} sep 
 * @returns {array} the strings of max length maxLength
 */
function autoPartsString(string, maxLength, sep) {
	const sepLength = sep.length
	const strings = string.split(sep);
	const lengths = strings.map(e => e.length)
	const result = []
	lengths.reduce((acc, val, i, arr) => {
		if (val + acc + sepLength <= maxLength)
			arr[i] += acc + sepLength
		else {
			let str = ""
			for (let y = 0; y < i; y++)
				str += strings.shift() + sep
			result.push(str)
		}
		return arr[i]
	})
	result.push(strings.join(sep))
	return result
}

module.exports = {
	BreakException,
	min,
	max,
	youtube_parser,
	convertISO8601ToSeconds,
	convertISO8601ToObject,
	convertISO8601ToSring,
	autoPartsString
}
