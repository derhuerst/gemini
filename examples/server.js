import createCert from 'create-cert'
import {
	createServer,
	DEFAULT_PORT,
} from '../index.js'

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

const keys = await createCert('example.org')

const server = createServer({
	tlsOpt: keys,
	// todo: SNICallback
}, onRequest)
server.on('error', console.error)

server.listen(DEFAULT_PORT, (err) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}

	const {address, port} = server.address()
	console.info(`listening on ${address}:${port}`)
})
