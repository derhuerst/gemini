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

// todo: try to DRY with lib/request-parser.js?

const CRLF = '\r\n'
const MAX_HEADER_SIZE = 2048 // cutoff

const createResponseParser = () => {
	let headerParsed = false
	let peek = Buffer.alloc(0)

	const invalid = () => {
		peek = null // allow garbage collection
		out.destroy(new Error('invalid Gemini response'))
	}

	let firstByteEmitted = false
	const emitFirstByte = () => {
		if (firstByteEmitted) return;
		// A consumer that wants to know that the first byte of the body has been received (peek) *must not* modify the stream's behaviour. This is why we need a separate `body-first-byte` event.
		// > Readable streams effectively operate in one of two modes: flowing and paused. […]
		// > - In flowing mode, data is read from the underlying system automatically and provided to an application as quickly as possible using events via the EventEmitter interface.
		// > - In paused mode, the stream.read() method must be called explicitly to read chunks of data from the stream.
		// > All Readable streams begin in paused mode but can be switched to flowing mode in one of the following ways:
		// > - Adding a 'data' event handler.
		// > […]
		// > For backward compatibility reasons, removing 'data' event handlers will not automatically pause the stream. […]
		// > If a Readable is switched into flowing mode and there are no consumers available to handle the data, that data will be lost. This can occur, for instance, when the readable.resume() method is called without a listener attached to the 'data' event, or when a 'data' event handler is removed from the stream.
		// https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_two_reading_modes
		out.emit('body-first-byte')
		firstByteEmitted = true
	}

	const onData = (data) => {
		if (headerParsed) {
			emitFirstByte()
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

		// todo: do this async?
		const iBody = iCRLF + 2
		if (peek.length > (iBody + 1)) {
			emitFirstByte()
			// `data` contains the beginning of the body
			out.push(peek.slice(iBody))
		}
		peek = null // allow garbage collection
	}

	// todo: emit error if readable ended without full response header(s)
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

// const p = createResponseParser()
// p.on('error', console.error)
// p.on('header', h => console.log('header', h))
// p.on('body-first-byte', () => console.log(`first byte of the body received`))
// p.on('data', d => console.log('data', d.toString('utf8')))
// const b = str => Buffer.from(str, 'utf8')
// p.write(b('31 gemini://examp'))
// p.write(b('le.org/foo?bar\r\n'))

module.exports = createResponseParser
