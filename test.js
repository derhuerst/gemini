'use strict'

const createCert = require('create-cert')
const {promisify: pify} = require('util')
const {strictEqual, fail} = require('assert')
const collect = require('get-stream')
const {
	createServer,
	DEFAULT_PORT,
	request,
} = require('.')

const r = pify(request)

const onRequest = (req, res) => {
	console.log('request', req.url)
	if (req.clientFingerprint) console.log('client fingerprint:', req.clientFingerprint)

	if (req.path === '/foo') {
		setTimeout(() => {
			if (!req.clientFingerprint) {
				return res.requestTransientClientCert('/foo is secret!')
			}
			res.write('foo')
			res.end('!')
		}, 500)
	} else if (req.path === '/bar') {
		setTimeout(() => {
			res.redirect('/foo')
		}, 500)
	} else {
		res.gone()
	}
}

const onError = (err) => {
	console.error(err)
	process.exit(1)
}

;(async () => {
	const server = createServer({
		tlsOpt: await createCert('example.org'),
	}, onRequest)

	server.on('error', onError)
	await pify(server.listen.bind(server))(DEFAULT_PORT)

	const res1 = await r('/bar', {
		tlsOpt: {rejectUnauthorized: false},
	})
	strictEqual(res1.statusCode, 30)
	strictEqual(res1.meta, '/foo')

	const baseOpts = {
		tlsOpt: {rejectUnauthorized: false},
		followRedirects: true,
		useClientCerts: true,
		letUserConfirmClientCertUsage: (_, cb) => cb(true),
	}
	const res2 = await r('/bar', {
		...baseOpts,
	})
	strictEqual(res2.statusCode, 20)
	strictEqual(await collect(res2), 'foo!')

	{
		let threw = false
		try {
			await r('/bar', {
				...baseOpts,
				useClientCerts: false,
			})
		} catch (err) {
			strictEqual(err.message, 'server request client cert, but client is configured not to send one', 'err.message is invalid')
			threw = true
		}
		if (!threw) fail(`request() didn't throw despite short timeout`)
	}

	{
		let threw = false
		try {
			await r('/bar', {
				...baseOpts,
				headersTimeout: 100, // too short for the mock server to respond
			})
		} catch (err) {
			strictEqual(err.code, 'ETIMEDOUT', 'err.code is invalid')
			strictEqual(err.message, 'timeout waiting for response headers', 'err.message is invalid')
			threw = true
		}
		if (!threw) fail(`request() didn't throw despite short timeout`)
	}

	{
		let threw = false
		try {
			await r('/bar', {
				...baseOpts,
				timeout: 100, // too short for the mock server to send the body
			})
		} catch (err) {
			strictEqual(err.code, 'ETIMEDOUT', 'err.code is invalid')
			strictEqual(err.message, 'timeout waiting for first byte of the response', 'err.message is invalid')
			threw = true
		}
		if (!threw) fail(`request() didn't throw despite short timeout`)
	}

	server.close()
})()
.catch(onError)
