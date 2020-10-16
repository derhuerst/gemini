# gemini

**[Gemini protocol](https://gemini.circumlunar.space) server & client.**

[![npm version](https://img.shields.io/npm/v/@derhuerst/gemini.svg)](https://www.npmjs.com/package/@derhuerst/gemini)
[![build status](https://api.travis-ci.org/derhuerst/gemini.svg?branch=master)](https://travis-ci.org/derhuerst/gemini)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/gemini.svg)
![minimum Node.js version](https://img.shields.io/node/v/@derhuerst/gemini.svg)
[![chat with me on Gitter](https://img.shields.io/badge/chat%20with%20me-on%20gitter-512e92.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installation

```shell
npm install @derhuerst/gemini
```


## Usage

### Server

The following code assumes that you have a valid SSL certificate & key.

```js
const {createServer, DEFAULT_PORT} = require('@derhuerst/gemini')

const handleRequest = (req, res) => {
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

const server = createGeminiServer({
	cert: …, // certificate (+ chain)
	key: …, // private key
	passphrase: …, // passphrase, if the key is encrypted
}, handleRequest)

server.listen(DEFAULT_PORT)
server.on('error', console.error)
```

### Client

```js
const request = require('@derhuerst/gemini/client')

request('/bar', (err, res) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}

	console.log(res.statusCode, res.statusMessage)
	if (res.meta) console.log(res.meta)
	res.pipe(process.stdout)
})
```

#### [TOFU](https://en.wikipedia.org/wiki/Trust_on_first_use)-style client certificates

> Interactive clients for human users MUST inform users that such a session has been requested and require the user to approve generation of such a certificate. Transient certificates MUST NOT be generated automatically.
– [Gemini spec](https://gemini.circumlunar.space/docs/spec-spec.txt), section 1.4.3

If is up to you how to implement that approval process. As an example, we're going to build a simple CLI prompt:

```js
const {createInterface} = require('readline')

const letUserConfirmClientCertUsage = ({host, reason}, cb) => {
	const prompt = createInterface({
		input: process.stdin,
		output: process.stdout,
		history: 0,
	})
	prompt.question(`Send client cert to ${host}? Server says: "${reason}". y/n > `, (confirmed) => {
		prompt.close()
		cb(confirmed === 'y' || confirmed === 'Y')
	})
}

request('/foo', {
	// opt into client certificates
	useClientCerts: true,
	letUserConfirmClientCertUsage,
}, cb)
```


## API

### `createServer`

```js
const createServer = require('@derhuerst/gemini/server')
createServer(opt = {}, onRequest)
```

`opt` extends the following defaults:

```js
{
	// SSL certificate & key
	cert: null, key: null, passphrase: null,
	// additional options to be passed into `tls.createServer`
	tlsOpt: {},
}
```

### `request`

```js
const request = require('@derhuerst/gemini/client')
request(pathOrUrl, opt = {}, cb)
```

`opt` extends the following defaults:

```js
{
	// follow redirects automatically
	followRedirects: false,
	// client certificates
	useClientCerts: false,
	letUserConfirmClientCertUsage: null,
	clientCertStore: defaultClientCertStore,
	// additional options to be passed into `tls.connect`
	tlsOpt: {},
}
```

### `connect`

```js
const connect = require('@derhuerst/gemini/connect')
connect(opt = {}, cb)
```

`opt` extends the following defaults:

```js
{
	hostname: '127.0.0.1',
	port: 1965,
	// client certificate
	cert: null, key: null, passphrase: null,
	// additional options to be passed into `tls.connect`
	tlsOpt: {},
}
```


## Related

- [`gemini-fetch`](https://github.com/RangerMauve/gemini-fetch) – Load data from the Gemini protocol the way you would fetch from HTTP in JavaScript


## Contributing

If you have a question or need support using `gemini`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, use [the issues page](https://github.com/derhuerst/gemini/issues).
