'use strict'

const {Transform} = require('stream')
const {CODES} = require('./statuses')

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.3.1
// > Gemini response headers look like this:
// > <STATUS><whitespace><META><CR><LF>
// > <STATUS> is a two-digit numeric status code, as described below in
// > 1.3.2 and in Appendix 1.
// > <whitespace> is any non-zero number of consecutive spaces or tabs.
// > <META> is a UTF-8 encoded string of maximum length 1024, whose
// > meaning is <STATUS> dependent.

const createResponse = () => {
	let headerSent = false
	const _sendHeader = () => {
		if (typeof res.statusCode !== 'number') {
			throw new Error('invalid res.statusCode')
		}
		const cat = Math.floor(res.statusCode / 10)

		if (cat === 2 && res.mimeType) {
			res.meta = res.mimeType // todo: validate
		}

		res.push(`${res.statusCode} ${res.meta}\r\n`)
		headerSent = true

		if (cat !== 2) res.push(null) // end
	}

	const sendHeader = (statusCode, meta = '') => {
		if (headerSent) throw new Error('header already sent')
		res.statusCode = statusCode
		res.meta = meta
		_sendHeader()
	}

	const write = (chunk, _, cb) => {
		if (!headerSent) _sendHeader()
		res.push(chunk)
		cb(null)
	}

	const res = new Transform({write})
	res.statusCode = CODES.SUCCESS
	res.meta = ''
	res.mimeType = null

	// API
	res.sendHeader = sendHeader
	res.prompt = (promptMsg) => {
		if (typeof promptMsg !== 'string') {
			throw new Error('invalid promptMsg')
		}
		sendHeader(10, promptMsg)
		res.push(null)
	}
	res.gone = () => {
		sendHeader(51)
		res.push(null)
	}
	// todo: redirect(), serverUnavailable(), slowDown(), badRequest()

	return res
}

module.exports = createResponse
