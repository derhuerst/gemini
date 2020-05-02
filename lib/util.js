'use strict'

// todo: clarify if ALPN is wanted & if this ID is correct
const ALPN_ID = 'gemini'

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.
// > When Gemini is served over TCP/IP, servers should listen on port 1965
// > (the first manned Gemini mission, Gemini 3, flew in March '65).
const DEFAULT_PORT = 1965

// https://gemini.circumlunar.space/docs/spec-spec.txt, 1.4.1
// > Servers MUST use TLS version 1.2 or higher and SHOULD use TLS version
// > 1.3 or higher.
const MIN_TLS_VERSION = 'TLSv1.2'

module.exports = {
	ALPN_ID,
	DEFAULT_PORT,
	MIN_TLS_VERSION,
}
