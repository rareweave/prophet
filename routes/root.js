const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
  fastify.get('/:id', async function (request, reply) {
    let tx = await fetch(config.arweaveGateway + "/" + request.params.id)
    if (tx.status != 200 && tx.status != 202) {
      return { error: "Invalid status from gateway" }
    }
    reply.raw.writeHead(tx.status, { ...Object.fromEntries(tx.headers.entries()), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*", })
    Readable.from(tx.body).pipe(reply.raw)
  })
}
