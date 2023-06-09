

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
        let search = request.query.search
        let collectionId = request.query.collection
        let startFrom = parseInt(request.query.startFrom) || 0
        let collection;

        return (await fastify.db.query(`SELECT contractTxId, timestamp, state, owner FROM nfts WHERE ($forSaleOnly IS NULL || state.forSale = true) AND ($ownedBy IS NULL || state.owner = $ownedBy) AND ($search IS NULL || (state.description ~ $search OR state.name ~ $search)) AND ($collectionId is NULL || ((contract:\`${collectionId}\`.state.items) CONTAINS contractTxId)) LIMIT 100 START ${startFrom};`,
            { ownedBy: ownedBy || null, search: search || null, forSaleOnly: request.query.forSaleOnly || null, collectionSrcIds: config.collectionSrcIds, collectionId: collectionId || null, collectionData: collection || [] }))[0]
    })
    fastify.get("/contract-interactions/:id", async (request, reply) => {
        let resp = (await fastify.db.query(`SELECT * from interactions WHERE contractId = $contractId`, { contractId: request.params.id }).catch(e => []))[0]?.result || []
        return resp;

    })
    fastify.get('/collections', async function (request, reply) {
        let ownedBy = request.query.ownedBy
        let search = request.query.search
        let startFrom = parseInt(request.query.startFrom) || 0

        return (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE $collectionSrcIds CONTAINS sourceId AND ($ownedBy IS NULL || state.admins CONTAINS $ownedBy) AND ($search IS NULL || (state.description ~ $search OR state.name ~ $search)) ORDER BY timestamp DESC LIMIT 100 START ${startFrom};`,
            { ownedBy: ownedBy || null, search: search || null, collectionSrcIds: config.collectionSrcIds || null }))[0]
    })
    fastify.get('/collection/:id', async function (request, reply) {
        let collectionId = JSON.parse(JSON.stringify(`"${request.params.id}"`))
        let resp = (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE ${JSON.stringify(config.collectionSrcIds)
            } CONTAINS sourceId AND contractTxId = ${collectionId} ORDER BY timestamp DESC LIMIT 100;`).catch(e => []))[0]

        return resp?.result[0] ? resp.result[0] : { error: "Not found" }
    })
}
