'use strict'

const {
	request,
	DEFAULT_PORT,
} = require('..')

const onError = (err) => {
	console.error(err)
	process.exit(1)
}

request('/foo', {
	tlsOpt: {
		rejectUnauthorized: false,
	},
}, (err, res) => {
	if (err) return onError(err)

	console.log(res.statusCode, res.statusMessage)
	if (res.meta) console.log(res.meta)
	res.pipe(process.stdout)
})
