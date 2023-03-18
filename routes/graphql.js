const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
    fastify.post('/graphql', async function (request, reply) {
        let weaveInfo = await fetch(config.arweaveGateway).then(r => r.json())
        if (request.method == "OPTIONS") { return true }
        let tx = await fetch(config.arweaveGQL, { method: request.method, body: JSON.stringify(request.body), headers: { "Content-type": "application/json" } }).catch(e => console.log(e)).then(res => res.json())

        if (tx?.data?.transactions?.edges) {
            tx.data.transactions.edges = tx.data.transactions?.edges.map(edge => ({ node: { ...edge.node, bundledIn: { id: null }, parent: { id: null }, block: edge.node.block || { height: weaveInfo.height, id: "UNSETTLED", timestamp: Date.now() } }, cursor: edge.cursor })) // warp discriminates bundled transactions
        }

        return tx

    })
    fastify.options("/graphql", async () => true)

}
