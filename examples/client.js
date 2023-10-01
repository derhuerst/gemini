'use strict'

const {createInterface} = require('readline')
const {request} = require('..')

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.4.3
// > Interactive clients for human users MUST inform users that such a session
// > has been requested and require the user to approve generation of such a
// > certificate. Transient certificates MUST NOT be generated automatically.
const letUserConfirmClientCertUsage = ({host, reason}, cb) => {
	const prompt = createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	prompt.question([
		`Send client cert to ${host}?`,
		reason ? ` Server says: "${reason}".` : '',
		' y/n > '
	].join(''), (confirmed) => {
		prompt.close()
		cb(confirmed === 'y' || confirmed === 'Y')
	})
}

const onError = (err) => {
	console.error(err)
	process.exit(1)
}

request('/bar', {
	followRedirects: true,
	useClientCerts: true, letUserConfirmClientCertUsage,
	tlsOpt: {
		rejectUnauthorized: false,
	},
}, (err, res) => {
	if (err) return onError(err)

	console.log(res.statusCode, res.statusMessage)
	if (res.meta) console.log(res.meta)
	res.pipe(process.stdout)
})
