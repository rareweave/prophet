const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
  fastify.get('/gateway/v2/interactions-sort-key', async function (request, reply) {
    if (!request.query.contractId) {
      reply.status(404)
      return { error: "No contract specified" }
    }
    let contractInitTx = await fastify.fetch(`http://127.0.0.1:${config.port}/tx/${request.query.contractId}`).then(res => res.json()).catch(e => null)
    if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
      reply.status(404)
      return { error: "No contract found" }
    }
    if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {
      reply.status(401)
      return { error: "This contract code isn't whitelisted" }
    }


    let interactions = await fastify.fetchInteractions(request.query.contractId, null)
    return {
      "paging": { "total": interactions.length, "limit": 5000, "items": interactions.length, "page": 1, "pages": 1 },
      interactions: interactions.reverse()
    }
  })
}
