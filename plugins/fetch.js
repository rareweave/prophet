const fp = require('fastify-plugin')
module.exports = fp(async function (fastify, opts) {
    let fetch = (await import("node-fetch")).default;
    fastify.decorate("fetch", fetch)
})