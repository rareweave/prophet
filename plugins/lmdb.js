const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const LmDB = require("lmdb")

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
module.exports = fp(async function (fastify, opts) {
    if (!fastify.kv) {
        const kv = await LmDB.open("prophetkv", { compression: false })
        fastify.decorate('kv', kv)
    }
}, {
    name: 'lmdb',
    dependencies: []
})
