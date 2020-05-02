'use strict'

const {parse: parseUrl} = require('url')
const connect = require('./connect')
const createParser = require('./lib/response-parser')
const {
	DEFAULT_PORT,
	ALPN_ID,
} = require('./lib/util')
const {CODES} = require('./lib/statuses')

const _request = (pathOrUrl, opt, cb) => {
	connect(opt, (err, socket) => {
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

const sendGeminiRequest = (pathOrUrl, opt, cb) => {
	if (typeof pathOrUrl !== 'string' || !pathOrUrl) {
		throw new Error('pathOrUrl must be a string & not empty')
	}
	if (typeof opt === 'function') {
		cb = opt
		opt = {}
	}
	const {
		followRedirects,
		cert, key, passphrase,
		tlsOpt,
	} = {
		followRedirects: false,
		cert: null, key: null, passphrase: null,
		tlsOpt: {},
		...opt,
	}

	const target = parseUrl(pathOrUrl)
	const hostname = target.hostname || 'localhost'
	const port = target.port || DEFAULT_PORT
	const reqOpt = {
		hostname, port,
		cert, key, passphrase,
		tlsOpt,
	}

	let onRes = cb
	if (followRedirects) {
		// todo: prevent endless redirects
		onRes = (err, res) => {
			if (err) return cb(err)

			if (
				res.statusCode === CODES.REDIRECT_TEMPORARY ||
				res.statusCode === CODES.REDIRECT_PERMANENT
			) {
				const newTarget = parseUrl(res.meta)
				_request(res.meta, {
					...reqOpt,
					host: newTarget.hostname || hostname,
					port: newTarget.port || port,
				}, onRes)
			} else {
				cb(null, res)
			}
		}
	}

	_request(pathOrUrl, reqOpt, onRes)
}

module.exports = sendGeminiRequest
