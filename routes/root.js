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

    reply.headers({
      "Content-Type": tx.headers.get("Content-Type"),
      "Access-Control-Allow-Origin": "*",
    })
    return Buffer.from(await tx.arrayBuffer())
  })
  fastify.options("/tx", async (req, resp) => {
    resp.status(200)
    return
  })
  fastify.options("/chunk", async (req, resp) => {
    resp.status(200)
    return
  })
  fastify.post("/tx", async (request, reply) => {
    let peers = [...(await fastify.kv.get("peers") || []), config.arweaveGateway].map(p => (p.startsWith("http://") || p.startsWith("https://")) ? p : `http://${p}`)
    peers.map(async peer => {
      fetch(`${peer}/tx`, { method: 'POST', headers: { 'Content-Type': "application/json" }, body: JSON.stringify(request.body) }).catch(e => null)
    })
    reply.header("Acess-Control-Allow-Origin", "*")
    reply.status(200)
    return "OK"
  })
  fastify.post("/chunk", async (request, reply) => {
    let peers = [...(await fastify.kv.get("peers") || []), config.arweaveGateway].map(p => (p.startsWith("http://") || p.startsWith("https://")) ? p : `http://${p}`)
    peers.map(async peer => {
      fetch(`${peer}/tx`, { method: 'POST', headers: { 'Content-Type': "application/json" }, body: JSON.stringify(request.body) }).catch(e => null)
    })
    reply.header("Acess-Control-Allow-Origin", "*")
    reply.status(200)
    return "OK"
  })
  fastify.get(`/wallet/:wallet/balance`, async (request, reply) => {
    reply.header("Acess-Control-Allow-Origin", "*")
    return fetch(`${config.arweaveGateway}/wallet/${request.params.wallet}/balance`).then(res => res.text()).catch(e => 0)
  })
  fastify.get(`/price/:dataSize/:address`, async (request, reply) => {
    reply.header("Acess-Control-Allow-Origin", "*")
    return fetch(`${config.arweaveGateway}/price/${request.params.dataSize}/${request.params.address}`).then(res => res.text()).catch(e => 0)
  })
  fastify.get(`/price/:dataSize`, async (request, reply) => {
    reply.header("Acess-Control-Allow-Origin", "*")
    return fetch(`${config.arweaveGateway}/price/${request.params.dataSize}`).then(res => res.text()).catch(e => 0)
  })
}
