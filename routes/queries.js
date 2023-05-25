

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
        // if (collectionId) {
        //     collection = (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract:\`${collectionId}\`;`, { collectionSrcIds: config.collectionSrcIds, collectionId: collectionId }).catch(e => []))[0]?.result[0] || {}
        // }

        let conditions = [ownedBy ? 'state.owner = $ownedBy' : '',
        search ? '(state.description ~ $search OR state.name ~ $search)' : '',
        request.query.forSaleOnly ? 'state.forSale = true' : '',
        collectionId ? `(contract:\`${collectionId}\`.state.items) CONTAINS contractTxId` : '']
        conditions = conditions.filter(c => c).map((c, ci) => `${ci ? 'AND' : 'WHERE'} ${c}`).join(" ")
        return (await fastify.db.query(`SELECT contractTxId, timestamp, state, owner FROM nfts ${conditions} LIMIT 100 START ${startFrom};`, { ownedBy: ownedBy, search: search, forSaleOnly: request.query.forSaleOnly, collectionSrcIds: config.collectionSrcIds, collectionId: collectionId, collectionData: collection || [] }))[0]
    })
    fastify.get("/contract-interactions/:id", async (request, reply) => {
        let resp = (await fastify.db.query(`SELECT * from contractInteractions WHERE contractId = $contractId`, { contractId: request.params.id }).catch(e => []))[0]?.result || []
        return resp;

    })
    fastify.get('/collections', async function (request, reply) {
        let ownedBy = request.query.ownedBy
        let search = request.query.search
        let startFrom = parseInt(request.query.startFrom) || 0

        return (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE $collectionSrcIds CONTAINS sourceId ${request.query.ownedBy ? 'AND state.admins CONTAINS $ownedBy' : ''} 
            ${request.query.search ? 'AND (state.description ~ $search OR state.name ~ $search)' : ''}
            ORDER BY timestamp DESC LIMIT 100 START ${startFrom};`, { ownedBy, search, collectionSrcIds: config.collectionSrcIds }))[0]
    })
    fastify.get('/collection/:id', async function (request, reply) {
        let collectionId = JSON.parse(JSON.stringify(`"${request.params.id}"`))
        let resp = (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE ${JSON.stringify(config.collectionSrcIds)
            } CONTAINS sourceId AND contractTxId = ${collectionId} ORDER BY timestamp DESC LIMIT 100;`).catch(e => []))[0]

        return resp?.result[0] ? resp.result[0] : { error: "Not found" }
    })
}
