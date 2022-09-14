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
		if (!res.writable) {
			// todo: debug-log: "response has already been closed/destroyed, cannot send header"
			return;
		}

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
	res.sendHeader = sendHeader

	// convenience API
	res.prompt = (promptMsg) => {
		if (typeof promptMsg !== 'string') throw new Error('invalid promptMsg')
		sendHeader(CODES.INPUT, promptMsg)
	}
	res.redirect = (url, permanent = false) => {
		sendHeader(permanent ? CODES.REDIRECT_PERMANENT : CODES.REDIRECT_TEMPORARY, url)
	}
	res.proxyError = (msg) => {
		if (typeof msg !== 'string') throw new Error('invalid msg')
		sendHeader(CODES.PROXY_ERROR, msg)
	}
	res.slowDown = (waitForSeconds) => {
		if (!Number.isInteger(waitForSeconds)) {
			throw new Error('invalid waitForSeconds')
		}
		sendHeader(CODES.SLOW_DOWN, waitForSeconds + '')
	}
	res.notFound = () => {
		sendHeader(CODES.NOT_FOUND)
	}
	res.gone = () => {
		sendHeader(CODES.GONE)
	}
	res.badRequest = (msg) => {
		if (typeof msg !== 'string') throw new Error('invalid msg')
		sendHeader(CODES.BAD_REQUEST, msg)
	}
	res.requestTransientClientCert = (reason) => {
		if (typeof reason !== 'string') throw new Error('invalid reason')
		sendHeader(CODES.TRANSIENT_CERT_REQUESTED, reason)
	}
	res.requestAuthorizedClientCert = (reason) => {
		if (typeof reason !== 'string') throw new Error('invalid reason')
		sendHeader(CODES.AUTHORISED_CERT_REQUIRED, reason)
	}

	return res
}

module.exports = createResponse
