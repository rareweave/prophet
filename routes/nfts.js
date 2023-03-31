

const fs = require("fs")
const { fetch } = require("undici")
const Arweave = require("arweave")
const { WarpFactory, ContractDefinitionLoader } = require("warp-contracts")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
const arweave = Arweave.init({
    host: "127.0.0.1",
    port: config.port,
    protocol: "http"
})

module.exports = async function (fastify, opts) {
    const warp = WarpFactory.forMainnet({

        inMemory: true,
    }, false, arweave)
    warp.definitionLoader.baseUrl = `http://localhost:${config.port}`
    warp.interactionsLoader.delegate.baseUrl = `http://localhost:${config.port}`


    fastify.get('/nfts', async function (request, reply) {
        let ownedBy = request.query.ownedBy
        return (await fastify.db.query(`SELECT contractTxId, state FROM cachedState WHERE ${JSON.stringify(config.nftSrcIds)} CONTAINS sourceId ${ownedBy ? 'AND state.owner = "' + ownedBy + '" LIMIT 100' : ''};`))[0]
    })
}
