

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
const thirdEm = require("@three-em/node/index")
module.exports = async function (fastify, opts) {
    fastify.get('/gateway/contract/', async function (request, reply) {
        if (!request.query.txId) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.txId}`).then(res => res.json()).catch(e => null)
        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
            reply.status(404)
            return { error: "No contract found" }
        }
        if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {
            reply.status(401)
            return { error: "This contract code isn't whitelisted" }
        }
        let contractCodeTx = await fetch(`http://127.0.0.1:${config.port}/tx/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.json()).catch(e => console.log(e))

        let contractCode = await fetch(`http://127.0.0.1:${config.port}/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.text()).catch(e => console.log(e))
        // let contractInfo = await fastify.db.select("contractInfo:" + request.query.contractId).catch(e => null)
        return {
            bundlerTxId: null,
            contractTx: { tags: contractInitTx.tags },
            initState: JSON.parse(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url")).value, 'base64url').toString()),
            manifest: contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Manifest").toString("base64url")) ?
                JSON.parse(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Manifest").toString("base64url")).value, 'base64url').toString()) : null,
            txId: request.query.txId,
            src: contractCode,
            srcTx: contractCodeTx,
            srcTxId: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()
        }
    })
    fastify.get('/gateway/v2/interactions-sort-key', async function (request, reply) {
        if (!request.query.contractId) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.contractId}`).then(res => res.json()).catch(e => null)
        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
            reply.status(404)
            return { error: "No contract found" }
        }
        if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {
            reply.status(401)
            return { error: "This contract code isn't whitelisted" }
        }


        let interactions = await fastify.syncToSecureHeight(request.query.contractId, null)

        return {
            "paging": { "total": interactions.length, "limit": 5000, "items": interactions.length, "page": 1, "pages": 1 },
            interactions: interactions.map(i => ({ "status": "confirmed", "confirming_peers": "51.159.210.149", "confirmations": "1", interaction: i }))
        }



        // console.log(await thirdEm.simulateContract({
        //     contractId: request.query.id,
        //     maybeContractSource: { contractType: 0, contractSrc: Buffer.from(contractCode) },
        //     interactions: [],
        //     contractInitState: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url")).value, 'base64url').toString(),
        //     maybeConfig: {
        //         host: "127.0.0.1",
        //         port: 8181,
        //         protocol: "http",
        //     },
        //     maybeCache: false,
        //     maybeBundledContract: false,
        //     maybeSettings: null,
        //     maybeExmContext: {}

        // }))
    })
}
