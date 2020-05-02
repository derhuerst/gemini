'use strict'

const {Transform} = require('stream')
const {MESSAGES} = require('./statuses')

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.3.1
// > Gemini response headers look like this:
// > <STATUS><whitespace><META><CR><LF>
// > <STATUS> is a two-digit numeric status code [...].
// > <whitespace> is any non-zero number of consecutive spaces or tabs.
// > <META> is a UTF-8 encoded string of maximum length 1024, whose meaning is
// > <STATUS> dependent.

const CRLF = '\r\n'
const MAX_HEADER_SIZE = 2048 // cutoff

const createResponseParser = () => {
	let headerParsed = false
	let peek = Buffer.alloc(0)

	const invalid = () => {
		peek = null
		out.destroy(new Error('invalid Gemini request'))
	}

	const onData = (data) => {
		if (headerParsed) {
			out.push(data)
			return;
		}

		peek = Buffer.concat([peek, data], peek.length + data.length)
		if (
			data.indexOf(CRLF) < 0 &&
			peek.length < MAX_HEADER_SIZE
		) return; // keep peeking

		const statusCodeAndSpace = peek.slice(0, 3).toString('utf8')
		if (!/\d{2} /.test(statusCodeAndSpace)) return invalid()
		const iCRLF = peek.indexOf(CRLF)
		if (iCRLF < 0) return invalid()

		let statusCode = parseInt(statusCodeAndSpace)
		let statusMsg = MESSAGES[statusCode]
		if (!statusMsg) {
			statusCode = Math.floor(statusCode / 10) * 10
			statusMsg = MESSAGES[statusCode]
			if (!statusMsg) return invalid()
		}

		const meta = peek.slice(3, iCRLF).toString('utf8').trim()

		headerParsed = true
		out.emit('header', {
			statusCode, statusMsg,
			meta,
		})

		const iBody = iCRLF + 2
		if (peek.length > (iBody + 1)) {
			// `data` contains the beginning of the body
			out.push(peek.slice(iBody))
		}
		peek = null // allow garbage collection
	}

	const out = new Transform({
		write: (chunk, _, cb) => {
			onData(chunk)
			cb()
		},
		writev: (chunks, cb) => {
			for (let i = 0; i < chunks.length; i++) {
				onData(chunks[i].chunk)
			}
			cb()
		},
	})
	return out
}

const p = createResponseParser()
p.on('error', console.error)
p.on('header', h => console.log('header', h))
p.on('data', d => console.log('data', d.toString('utf8')))
const b = str => Buffer.from(str, 'utf8')
p.write(b('31 gemini://examp'))
p.write(b('le.org/foo?bar\r\n'))

module.exports = createResponseParser
