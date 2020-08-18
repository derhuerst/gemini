'use strict'

const {connect: connectTls} = require('tls')
const {
	DEFAULT_PORT,
	ALPN_ID,
	MIN_TLS_VERSION,
} = require('./lib/util')

const connectToGeminiServer = (opt, cb) => {
	if (typeof opt === 'function') {
		cb = opt
		opt = {}
	}
	const {
		hostname,
		port,
		cert, key, passphrase,
		tlsOpt,
	} = {
		hostname: '127.0.0.1',
		port: DEFAULT_PORT,
		cert: null, key: null, passphrase: null,
		tlsOpt: {},
		...opt,
	}

	const socket = connectTls({
		ALPNProtocols: [ALPN_ID],
		minVersion: MIN_TLS_VERSION,
		host: hostname,
		port,
		cert, key, passphrase,
		...tlsOpt,
	})

	let cbCalled = false
	socket.once('error', (err) => {
		if (cbCalled) return;
		cbCalled = true
		cb(err)
	})
	socket.once('secureConnect', () => {
		if (cbCalled) return;
		cbCalled = true
		cb(null, socket)
	})

	return socket
}

module.exports = connectToGeminiServer
