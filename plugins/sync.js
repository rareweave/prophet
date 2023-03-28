const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const crypto = require("crypto")
const thirdEm = require("@three-em/node/index")
const { fetch } = require('undici')
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
  async function syncToSecureHeight(id, contractInfo) {
    let warpSequencerTxs = (await fetch(`https://gateway.warp.cc/gateway/v2/interactions-sort-key?contractId=` + id).then(r => r.json())).interactions.map(i => i.interaction)
    const networkInfo = await fetch('http://127.0.0.1:' + config.port + "/info").then(res => res.json())
    let height = networkInfo.height
    let fetchHeight = height - 10
    let pageInfo = { hasNextPage: true }
    let transactions = []
    while (pageInfo.hasNextPage) {
      let gqlreply = await fetch('http://localhost:' + config.port + '/graphql', txQuery(fetchHeight, [["Contract", id]])).then(res => res.json()).catch(e => pageInfo.hasNextPage = false)
      console.log(JSON.parse(txQuery(fetchHeight, [["Contract", id]]).body).query)
      pageInfo = gqlreply.data.transactions.pageInfo
      // let timestamps = await fetch('https://node2.bundlr.network/graphql', bundlrTimestampsQuery(gqlreply.data.transactions.edges.map(node => node.node.id))).then(res => res.json()).catch(e => [])
      // timestamps = Object.fromEntries(timestamps.data.transactions.edges.map(ts => [ts.node.id, ts.node.timestamp]))
      // gqlreply.data.transactions.edges = gqlreply.data.transactions.edges.map(edge => ({ node: { ...edge.node, timestamp: timestamps[edge.node.id] || "0" } }))

      transactions.push(...gqlreply.data.transactions.edges.map(e => e.node))
    }
    transactions = await Promise.all(transactions.filter(tx => !warpSequencerTxs.find(wtx => wtx.id == tx.id)).map(async tx => {

      return {
        ...tx,
        sortKey: `${tx.block.height.toString().padStart(12, "0")},0000000000000000,${Buffer.from(await arweave.crypto.hash(arweave.utils.concatBuffers([arweave.utils.b64UrlToBuffer(tx.block.id), arweave.utils.b64UrlToBuffer(tx.id)]))).toString("hex")}`,
        confirmationStatus: "confirmed"
      }
    }))
    warpSequencerTxs.unshift(...transactions)
    return warpSequencerTxs
    // const networkInfo = await fetch('http://127.0.0.1:' + config.port + "/info").then(res => res.json())
    // let height = networkInfo.height
    // let secureHeight = height - 10
    // let pageInfo = { hasNextPage: true }
    // let transactions = []
    // while (pageInfo.hasNextPage) {
    //   let gqlreply = await fetch('http://localhost:' + config.port + '/graphql', txQuery(secureHeight, contractInfo?.syncHeight, [["Contract", id]])).then(res => res.json()).catch(e => pageInfo.hasNextPage = false)
    //   pageInfo = gqlreply.data.transactions.pageInfo
    //   // let timestamps = await fetch('https://node2.bundlr.network/graphql', bundlrTimestampsQuery(gqlreply.data.transactions.edges.map(node => node.node.id))).then(res => res.json()).catch(e => [])
    //   // timestamps = Object.fromEntries(timestamps.data.transactions.edges.map(ts => [ts.node.id, ts.node.timestamp]))
    //   // gqlreply.data.transactions.edges = gqlreply.data.transactions.edges.map(edge => ({ node: { ...edge.node, timestamp: timestamps[edge.node.id] || "0" } }))
    //   gqlreply.data.transactions.edges = gqlreply.data.transactions.edges.map(edge => {
    //     edge = {
    //       node: {
    //         ...edge.node, block: { height: edge.node.block.height.toString(), timestamp: edge.node.block.timestamp.toString(), indepHash: edge.node.block.id, },
    //         reward: edge.node.fee.winston
    //       }
    //     }
    //     delete edge.node.bundledIn
    //     delete edge.node.fee

    //     return edge
    //   })
    //   transactions.push(...gqlreply.data.transactions.edges)
    // }
    // transactions = transactions.map(tx => ({ ...tx.node, owner: tx.node.owner.address, quantity: tx.node.quantity.winston, input: tx.node.tags.find(t => t.name == "Input").value })).filter(tx => !(contractInfo?.processed || []).includes(tx.id))
    // let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${id}`).then(res => res.json()).catch(e => null)
    // let initState;
    // if (!contractInfo?.cachedState) {
    //   initState = Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url")).value, 'base64url').toString()
    // } else {
    //   initState = Buffer.from(contractInfo.cachedState, 'base64url').toString()
    // }
    // let contractCode = await fetch(`http://127.0.0.1:${config.port}/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.text()).catch(e => console.log(e))

    // return transactions

  }

  fastify.decorate("syncToSecureHeight", syncToSecureHeight)
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