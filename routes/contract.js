

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

    fastify.get('/contract', async function (request, reply) {
        if (!request.query.id) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`).then(res => res.json()).catch(e => null)
        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
            reply.status(404)
            return { error: "No contract found" }
        }
        if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {
            reply.status(401)
            return { error: "This contract code isn't whitelisted" }
        }
        console.log(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url")).value, 'base64url').toString())
        let contractCode = await fetch(`http://127.0.0.1:${config.port}/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.text()).catch(e => console.log(e))

        console.log(await thirdEm.simulateContract({
            contractId: request.query.id,
            maybeContractSource: { contractType: 0, contractSrc: Buffer.from(contractCode) },
            interactions: [],
            contractInitState: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url")).value, 'base64url').toString(),
            maybeConfig: {
                host: "127.0.0.1",
                port: 8181,
                protocol: "http",
            },
            maybeCache: false,
            maybeBundledContract: false,
            maybeSettings: null,
            maybeExmContext: {}

        }))
    })
}
