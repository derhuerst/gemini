'use strict'

const {request} = require('..')

const onError = (err) => {
	console.error(err)
	process.exit(1)
}

request('/bar', {
	followRedirects: true,
	tlsOpt: {
		rejectUnauthorized: false,
	},
}, (err, res) => {
	if (err) return onError(err)

	console.log(res.statusCode, res.statusMessage)
	if (res.meta) console.log(res.meta)
	res.pipe(process.stdout)
})
