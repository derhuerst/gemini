'use strict'

const {createServer: createTlsServer} = require('tls')
const {EventEmitter} = require('events')
const createParser = require('./lib/request-parser')
const createResponse = require('./lib/response')
const {ALPN_ID} = require('./lib/util')

const createGeminiServer = (opt = {}, onRequest) => {
	if (typeof opt === 'function') {
		onRequest = opt
		opt = {}
	}
	const {
		tlsOpt,
	} = {
		tlsOpt: {},
		...opt,
	}

	const onConnection = (socket) => {
		const req = createParser()
		socket.pipe(req)
		socket.once('error', (err) => {
			socket.unpipe(req)
			req.destroy(err)
		})

		const close = () => {
			socket.destroy()
			req.destroy()
		}
		let timeout = setTimeout(close, 20 * 1000)

		req.once('header', (header) => {
			clearTimeout(timeout)

			// prepare req
			req.socket = socket
			req.url = header.url
			const url = new URL(header.url, 'http://foo/')
			req.path = url.pathname
			// todo: req.abort(), req.destroy()

			// prepare res
			const res = createResponse()
			res.pipe(socket)
			res.once('error', (err) => {
				console.error('error', err)
				res.unpipe(socket)
				socket.destroy(err)
			})
			Object.defineProperty(res, 'socket', {value: socket})

			onRequest(req, res)
			server.emit('request', req, res)
		})
	}

	const server = createTlsServer({
		ALPNProtocols: [ALPN_ID],
		// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.4.1
		// > Servers MUST use TLS version 1.2 or higher and SHOULD use TLS version
		// > 1.3 or higher.
		minVersion: 'TLSv1.2',
		requestCert: !!alwaysRequireClientCert,
		// > Gemini requests typically will be made without a client
		// > certificate being sent to the server. If a requested resource
		// > is part of a server-side application which requires persistent
		// > state, a Gemini server can [...] request that the client repeat
		// the request with a "transient certificate" to initiate a client
		// > certificate section.
		rejectUnauthorized: false,
		...tlsOpt,
	}, onConnection)

	return server
}

module.exports = createGeminiServer
