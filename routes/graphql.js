const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
    fastify.post('/graphql', async function (request, reply) {
        let weaveInfo = await fetch(config.arweaveGateway).then(r => r.json())
        if (request.method == "OPTIONS") { return true }
        if (request.body.variables && request.body.variables.blockFilter) {
            request.body.variables.blockFilter.min--
        }
        let tx = await fetch(config.arweaveGQL, { method: request.method, body: JSON.stringify(request.body), headers: { "Content-type": "application/json" } }).catch(e => console.log(e)).then(res => res.json())

        if (tx?.data?.transactions?.edges) {

            console.log(request.body.variables)
            tx.data.transactions.edges = tx.data.transactions?.edges.map(edge => ({ node: { ...edge.node, bundledIn: null, parent: null, block: edge.node.block || { height: weaveInfo.height, id: "PENDING", timestamp: Date.now() } }, cursor: edge.cursor })) // warp discriminates bundled transactions

            console.log("resp", tx.data.transactions.edges.map(edge => edge.node.tags))
        }

        return tx

    })
    fastify.options("/graphql", async () => true)

}