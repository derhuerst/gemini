'use strict'

const {Transform} = require('stream')

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.2
// > Gemini requests are a single CRLF-terminated line with the
// > following structure: <URL><CR><LF>
// > <URL> is a UTF-8 encoded absolute URL, of maximum length
// > 1024 bytes. [...]

// todo: try to DRY with lib/response-parser.js?

const CRLF = '\r\n'
const MAX_HEADER_SIZE = 1024 + CRLF.length

const createRequestParser = () => {
	let headerParsed = false
	let peek = Buffer.alloc(0)

	const invalid = () => {
		peek = null // allow garbage collection
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

		const iCRLF = peek.indexOf(CRLF)
		if (iCRLF < 0) return invalid()

		const url = peek.slice(0, iCRLF).toString('utf8')
		headerParsed = true
		out.emit('header', {url})

		const iBody = iCRLF + 2
		if (peek.length > (iBody + 1)) {
			// `data` contains the beginning of the body
			out.push(peek.slice(iBody))
		}
		peek = null // allow garbage collection
	}

	// todo: emit error if readable ended without full header
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

// const p = createRequestParser()
// p.on('error', console.error)
// p.on('header', h => console.log('header', h))
// p.on('data', d => console.log('data', d.toString('utf8')))
// const b = str => Buffer.from(str, 'utf8')
// p.write(b('gemini://examp'))
// p.write(b('le.org/foo?bar#baz\r\nhel'))
// p.end(b('lo server!'))

module.exports = createRequestParser
