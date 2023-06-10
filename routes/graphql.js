const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
    fastify.post('/graphql', async function (request, reply) {

        if (request.method == "OPTIONS") { return true }

        let tx = await fastify.fetch(config.arweaveGQL, { method: request.method, body: JSON.stringify(request.body), headers: { "Content-type": "application/json" } }).catch(e => console.log(e)).then(res => res.json())


        return tx

    })
    fastify.options("/graphql", async () => true)

}