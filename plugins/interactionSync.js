const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const crypto = require("crypto")
const thirdEm = require("@three-em/node/index")
const { fetch } = require('undici')
const Arweave = require("arweave")
const arweave = Arweave.init({
    host: "127.0.0.1",
    port: config.port,
    protocol: "http"
})
module.exports = fp(async function (fastify, opts) {
    let networkInfo = await fetch(config.arweaveGateway + "/info").then(res => res.json())
    let contractsToBeUpdated = (await fastify.db.query("SELECT contractId, lastUpdateBlock FROM indexedContracts WHERE lastUpdateBlock < $currentHeight", { currentHeight: networkInfo?.height }))[0].result

    setTimeout(async function updateInteractions() {
        networkInfo = await fetch(config.arweaveGateway + "/info").catch(e => ({ json: () => null })).then(res => res.json())
        contractsToBeUpdated = (await fastify.db.query("SELECT contractId, lastUpdateBlock FROM indexedContracts WHERE lastUpdateBlock < $currentHeight", { currentHeight: networkInfo?.height }))[0].result
        for (const outdatedContract of contractsToBeUpdated) {
            let txs = (await fetchTxsFromHeight(outdatedContract.contractId, outdatedContract.lastUpdateBlock)).map(t => ({ ...t, contract: outdatedContract.contractId, id: "interactions:`" + t.id + "`" }))
            fastify.db.query(`INSERT INTO interactions $interactions; UPDATE indexedContracts:\`${outdatedContract.contractId}\` SET lastUpdateBlock = $currentHeight;`, { currentHeight: networkInfo?.height, interactions: txs })
        }

        setTimeout(updateInteractions, Math.max(10000, contractsToBeUpdated.length))

        console.log("Network info", networkInfo)
    }, Math.max(10000, contractsToBeUpdated.length * 1000))
    // console.log("Network info", networkInfo)
}, {
    name: 'interactionSync',
    dependencies: ['lmdb', 'surrealdb']
})
async function fetchTxsFromHeight(contractId, height) {
    height -= 1
    let pageInfo = { hasNextPage: true }
    let transactions = []
    let cursor = null
    while (pageInfo.hasNextPage) {

        let gqlreply = await fetch(config.arweaveGQL, txQuery(height, [["Contract", contractId]], cursor)).then(res => res.json()).catch(e => pageInfo.hasNextPage = false)

        pageInfo = gqlreply?.data?.transactions?.pageInfo || false;

        gqlreply?.data?.transactions?.edges ? transactions.push(...gqlreply?.data?.transactions?.edges?.map(e => e.node)) : '';
        cursor = (gqlreply?.data?.transactions?.edges[gqlreply.data.transactions.edges.length - 1])?.cursor || null
    }
    return transactions
}
const txQuery = (min, tags, cursor) => {
    return {
        body: JSON.stringify({
            query: `query {
  transactions(${cursor ? 'after: "' + cursor + '", ' : ''}sort:HEIGHT_ASC, block: { min:${min} },tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ["${tag[1]}"] }`)).join("\n")}], bundledIn:null) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
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