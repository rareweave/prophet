const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
    fastify.get('/peers', async function (request, reply) {
        let peers = [...(await fastify.kv.get("peers") || []), config.arweaveGateway].map(p => (p.startsWith("http://") || p.startsWith("https://")) ? p : `http://${p}`)
        return [...new Set(peers.map(p => {
            if (p.startsWith("http://")) {
                return p.slice(('http://').length)
            } else if (p.startsWith("https://")) {
                return p.slice(('https://').length)
            } else {
                return p
            }
        }))]
    })
}