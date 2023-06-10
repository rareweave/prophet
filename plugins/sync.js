const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const crypto = require("crypto")
const Arweave = require("arweave")
/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
const arweave = Arweave.init({
  host: "127.0.0.1",
  port: config.port,
  protocol: "http"
})
module.exports = fp(async function (fastify, opts) {

  setInterval(updatePeers, 50000)
  async function updatePeers() {
    let peers = [...(await fastify.kv.get("peers") || []), config.arweaveGateway]
    let newPeers = []
    await Promise.all(peers.map(async peer => {
      let subpeers = await fastify.fetch(`${peer}/peers`).then(res => res.json()).catch((e) => [])
      // peers = [...new Set([...peers, ...subpeers])]
      newPeers.push(subpeers.map(p => `http://${p}`))
    }))
    await fastify.kv.put("peers", new Set([...peers, ...newPeers.reduce((pv, cv) => [...pv, ...cv], [])]))

  }
  async function fetchInteractions(id, contractInfo) {


    let transactions = (await fastify.db.query("SELECT * FROM interactions WHERE contract = $contract ORDER BY block.height ASC;", { contract: id }))[0].result || []


    transactions = await Promise.all(transactions.map(async tx => {

      return {
        ...tx,
        sortKey: `${tx.block.height.toString().padStart(12, "0")},0000000000000000,${Buffer.from(await arweave.crypto.hash(arweave.utils.concatBuffers([arweave.utils.b64UrlToBuffer(tx.block.id), arweave.utils.b64UrlToBuffer(tx.id)]))).toString("hex")}`,
        confirmationStatus: "confirmed"
      }
    }))
    return transactions


  }
  async function useTimedCache(id, type, cacheBringer, time = null) {
    if (!id || !cacheBringer) { return null }
    let cache = (await fastify.db.select(type + ":`" + id + "`").catch(e => { return [] }))[0]
    if ((time || 10001) > 10000 && cache?.error) { time = 10000 }
    if (!cache || (time && ((Date.now() - cache?.timestamp) > time))) {
      let freshResult = await cacheBringer()
      fastify.db.query(`INSERT INTO ${type} $data;`, { data: { id: type + ":`" + id + "`", ...freshResult, timestamp: Date.now() } })
      return freshResult
    } else {
      return cache
    }
  }

  fastify.decorate("fetchInteractions", fetchInteractions)
  fastify.decorate("timedCache", useTimedCache)
})
const txQuery = (min, tags) => {
  return {
    body: JSON.stringify({
      query: `query {
  transactions(sort:HEIGHT_ASC, block: { min:${min} },tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ["${tag[1]}"] }`)).join("\n")}], bundledIn:null) {
    pageInfo {
        hasNextPage
    }
    edges {
      node {
        id
        tags {
          name
          value
        }
        owner {
          
          address
        }
        quantity{
          winston
        }
        recipient
        fee {
          winston
        }
        block {
          id
          height
          timestamp
        }
       
      }
    }
  }
}
`}),
    method: "POST", headers: { "Content-type": "application/json" }
  }
}

const bundlrTimestampsQuery = (transactions) => {
  return {
    body: JSON.stringify({
      query: `query {
  transactions(limit:100, ids: [${transactions.map(tx => '"' + tx + '"').join(", ")}]) {
    edges {
      cursor,
      node {
        id
        timestamp
      }
    }
  }
}
`}),
    method: "POST", headers: { "Content-type": "application/json" }
  }
}