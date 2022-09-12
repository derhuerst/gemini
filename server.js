'use strict'

const debug = require('debug')('gemini:server')
const {createServer: createTlsServer} = require('tls')
const {EventEmitter} = require('events')
const {pipeline: pipe} = require('stream')
const createParser = require('./lib/request-parser')
const createResponse = require('./lib/response')
const {
	ALPN_ID,
	MIN_TLS_VERSION,
} = require('./lib/util')

const createGeminiServer = (opt = {}, onRequest) => {
	if (typeof opt === 'function') {
		onRequest = opt
		opt = {}
	}
	const {
		cert, key, passphrase,
		tlsOpt,
		verifyAlpnId,
	} = {
		cert: null, key: null, passphrase: null,
		tlsOpt: {},
		verifyAlpnId: alpnId => alpnId ? alpnId === ALPN_ID : true,
		...opt,
	}

	const onConnection = (socket) => {
		debug('connection', socket)

		// todo: clarify if this is desired behavior
		if (verifyAlpnId(socket.alpnProtocol) !== true) {
			debug('invalid ALPN ID, closing socket')
			socket.destroy()
			return;
		}
		if (
			socket.authorizationError &&
			// allow self-signed certs
			socket.authorizationError !== 'SELF_SIGNED_CERT_IN_CHAIN' &&
			socket.authorizationError !== 'DEPTH_ZERO_SELF_SIGNED_CERT' &&
			socket.authorizationError !== 'UNABLE_TO_GET_ISSUER_CERT'
		) {
			debug('authorization error, closing socket')
			socket.destroy(new Error(socket.authorizationError))
			return;
		}
		const clientCert = socket.getPeerCertificate()

		const req = createParser()
		pipe(
			socket,
			req,
			(err) => {
				if (err) debug('error receiving request', err)
				if (timeout && err) {
					debug('socket closed while waiting for header')
				}
				// todo? https://nodejs.org/api/http.html#http_event_clienterror
			},
		)

		const reportTimeout = () => {
			socket.destroy(new Error('timeout waiting for header'))
		}
		let timeout = setTimeout(reportTimeout, 20 * 1000)
		timeout.unref()

		req.once('header', (header) => {
			clearTimeout(timeout)
			timeout = null
			debug('received header', header)

			// prepare req
			req.socket = socket
			req.url = header.url
			const url = new URL(header.url, 'http://foo/')
			req.path = url.pathname
			if (clientCert && clientCert.fingerprint) {
				req.clientFingerprint = clientCert.fingerprint
			}
			// todo: req.abort(), req.destroy()

			// prepare res
			const res = createResponse()
			Object.defineProperty(res, 'socket', {value: socket})

			pipe(
				res,
				socket,
				(err) => {
					if (err) debug('error sending response', err)
				},
			)

			onRequest(req, res)
			server.emit('request', req, res)
		})
	}

	const server = createTlsServer({
		// Disabled ALPNProtocols to mitigate connection issues in gemini
		// clients as reported in #5
		// ALPNProtocols: [ALPN_ID],
		minVersion: MIN_TLS_VERSION,
		// > Usually the server specifies in the Server Hello message if a
		// > client certificate is needed/wanted.
		// > Does anybody know if it is possible to perform an authentication
		// > via client cert if the server does not request it?
		//
		// > The client won't send a certificate unless the server asks for it
		// > with a `Certificate Request` message (see the standard, section
		// > 7.4.4). If the server does not ask for a certificate, the sending
		// > of a `Certificate` and a `CertificateVerify` message from the
		// > client is likely to imply an immediate termination from the server
		// > (with an unexpected_message alert).
		// https://security.stackexchange.com/a/36101
		requestCert: true,
		// > Gemini requests typically will be made without a client
		// > certificate being sent to the server. If a requested resource
		// > is part of a server-side application which requires persistent
		// > state, a Gemini server can [...] request that the client repeat
		// the request with a "transient certificate" to initiate a client
		// > certificate section.
		rejectUnauthorized: false,
		cert, key, passphrase,
		...tlsOpt,
	}, onConnection)

	return server
}

module.exports = createGeminiServer
