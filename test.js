'use strict'

const createCert = require('create-cert')
const {promisify: pify} = require('util')
const {strictEqual} = require('assert')
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
		if (!req.clientFingerprint) {
			return res.requestTransientClientCert('/foo is secret!')
		}
		res.write('foo')
		res.end('!')
	} else if (req.path === '/bar') {
		res.redirect('/foo')
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

	const res2 = await r('/bar', {
		tlsOpt: {rejectUnauthorized: false},
		followRedirects: true,
		useClientCerts: true,
		letUserConfirmClientCertUsage: (_, cb) => cb(true),
	})
	strictEqual(res2.statusCode, 20)
	strictEqual(await collect(res2), 'foo!')

	server.close()
})()
.catch(onError)
