'use strict'

const debug = require('debug')('gemini:connect')
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
	debug('connectToGeminiServer', opt)
	const {
		hostname,
		port,
		cert, key, passphrase,
		connectTimeout,
		tlsOpt,
	} = {
		hostname: '127.0.0.1',
		port: DEFAULT_PORT,
		cert: null, key: null, passphrase: null,
		// todo [breaking]: reduce to e.g. 20s
		connectTimeout: 60 * 1000, // 60s
		tlsOpt: {},
		...opt,
	}

	const socket = connectTls({
		ALPNProtocols: [ALPN_ID],
		minVersion: MIN_TLS_VERSION,
		host: hostname,
		servername: hostname,
		port,
		cert, key, passphrase,
		...tlsOpt,
	})

	// Sets the socket to timeout after timeout milliseconds of inactivity on
	// the socket. By default net.Socket do not have a timeout.
	// When an idle timeout is triggered the socket will receive a 'timeout'
	// event but the connection will not be severed. The user must manually
	// call socket.end() or socket.destroy() to end the connection.
	// https://nodejs.org/api/net.html#net_socket_setnodelay_nodelay
	let timeoutTimer = null
	const onTimeout = () => {
		clearTimeout(timeoutTimer)
		const err = new Error('connect timeout')
		err.timeout = connectTimeout
		err.code = 'ETIMEDOUT' // is it okay to mimic syscall errors?
		err.errno = -60
		socket.destroy(err)
	}
	socket.once('timeout', onTimeout)
	if (connectTimeout !== null) {
		// This sets the timeout for inactivity on the *socket* layer. But the
		// TLS handshake might also stall. This is why we also set one manually.
		// see also https://github.com/nodejs/node/issues/5757
		socket.setTimeout(connectTimeout)
		timeoutTimer = setTimeout(onTimeout, connectTimeout)
		timeoutTimer.unref()
	}

	let cbCalled = false
	socket.once('error', (err) => {
		debug('socket error', err)
		if (cbCalled) return;
		cbCalled = true
		cb(err)
	})
	socket.once('secureConnect', () => {
		if (cbCalled) return;
		// If timeout is 0, then the existing idle timeout is disabled.
		// https://nodejs.org/api/net.html#net_socket_setnodelay_nodelay
		socket.setTimeout(0)
		clearTimeout(timeoutTimer)

		cbCalled = true
		cb(null, socket)
	})

	return socket
}

module.exports = connectToGeminiServer
