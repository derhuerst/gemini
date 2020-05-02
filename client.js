'use strict'

const connect = require('./connect')
const createParser = require('./lib/response-parser')
const {
	DEFAULT_PORT,
	ALPN_ID,
} = require('./lib/util')

const sendGeminiRequest = (pathOrUrl, opt, cb) => {
	if (typeof pathOrUrl !== 'string' || !pathOrUrl) {
		throw new Error('pathOrUrl must be a string & not empty')
	}
	if (typeof opt === 'function') {
		cb = opt
		opt = {}
	}
	const {
		port,
		tlsOpt,
	} = {
		port: DEFAULT_PORT,
		tlsOpt: {},
		...opt,
	}

	connect({
		port, tlsOpt,
	}, (err, socket) => {
		if (err) return cb(err)

		if (socket.alpnProtocol !== ALPN_ID) {
			socket.destroy()
			return cb(new Error('invalid or missing ALPN protocol'))
		}

		const res = createParser()
		socket.pipe(res)
		socket.once('error', (err) => {
			socket.unpipe(res)
			res.destroy(err)
		})

		const close = () => {
			socket.destroy()
			res.destroy()
		}
		let timeout = setTimeout(close, 20 * 1000)

		res.once('header', (header) => {
			clearTimeout(timeout)

			// prepare res
			res.socket = socket
			res.statusCode = header.statusCode
			res.statusMessage = header.statusMsg
			res.meta = header.meta // todo: change name
			// todo: res.abort(), res.destroy()

			cb(null, res)
			socket.emit('response', res)
		})

		// send request
		socket.end(encodeURI(pathOrUrl) + ' \r\n')
	})
}

module.exports = sendGeminiRequest
