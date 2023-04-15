

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
        let ownedBy = JSON.parse(JSON.stringify(`"${request.query.ownedBy}"`))
        let search = JSON.parse(JSON.stringify(`"${request.query.search}"`))
        let collectionId = JSON.parse(JSON.stringify(`"${request.query.collection}"`))
        let collection;
        if (collectionId) {
            collection = (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE ${JSON.stringify(config.collectionSrcIds)
                } CONTAINS sourceId AND contractTxId = ${collectionId} ORDER BY timestamp DESC LIMIT 100;`).catch(e => []))[0].result[0]
        }
        return (await fastify.db.query(`SELECT contractTxId, timestamp, state, owner FROM nfts WHERE ${JSON.stringify(config.nftSrcIds)
            } CONTAINS sourceId ${request.query.ownedBy ? 'AND state.owner = ' + ownedBy : ''} 
            ${request.query.search ? 'AND (state.description ~ ' + search + ' OR state.name ~ ' + search + ')' : ''}
            ${request.query.forSaleOnly ? 'AND state.forSale = true' : ''} ${collectionId ? 'AND ' + JSON.stringify(collection?.state?.items || []) + ' CONTAINS contractTxId' : ''} ORDER BY timestamp DESC LIMIT 100;`))[0]
    })

    fastify.get('/collections', async function (request, reply) {
        let ownedBy = JSON.parse(JSON.stringify(`"${request.query.ownedBy}"`))
        let search = JSON.parse(JSON.stringify(`"${request.query.search}"`))


        return (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE ${JSON.stringify(config.collectionSrcIds)
            } CONTAINS sourceId ${request.query.ownedBy ? 'AND state.admins CONTAINS ' + ownedBy : ''} 
            ${request.query.search ? 'AND (state.description ~ ' + search + ' OR state.name ~ ' + search + ')' : ''}
            ORDER BY timestamp DESC LIMIT 100;`))[0]
    })
    fastify.get('/collection/:id', async function (request, reply) {
        let collectionId = JSON.parse(JSON.stringify(`"${request.params.id}"`))
        let resp = (await fastify.db.query(`SELECT contractTxId, timestamp, state FROM contract WHERE ${JSON.stringify(config.collectionSrcIds)
            } CONTAINS sourceId AND contractTxId = ${collectionId} ORDER BY timestamp DESC LIMIT 100;`).catch(e => []))[0]

        return resp?.result[0] ? resp.result[0] : { error: "Not found" }
    })
}
