import {createInterface} from 'readline'
import {request} from '../index.js'

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

request('/bar', {
	followRedirects: true,
	useClientCerts: true, letUserConfirmClientCertUsage,
	tlsOpt: {
		rejectUnauthorized: false,
	},
}, (err, res) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}

	console.log(res.statusCode, res.statusMessage)
	if (res.meta) console.log(res.meta)
	res.pipe(process.stdout)
})
