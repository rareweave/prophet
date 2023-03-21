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

    fastify.get('/contract', { description: 'Get information about a whitelisted contract' }, async function (request, reply) {
        if (!request.query.id) {
            reply.status(400)
            return { error: "Missing contract ID" }
        }
        try {
            const contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`).then(res => res.json())
            const contractSrcTag = contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))
            if (!contractInitTx || contractInitTx.error || !contractSrcTag) {
                reply.status(404)
                return { error: "No contract found" }
            }
            const contractCode = await fetch(`http://127.0.0.1:${config.port}/${Buffer.from(contractSrcTag.value, 'base64url').toString()}`).then(res => res.text())
            if (!config.whitelistedCodes.includes(Buffer.from(contractSrcTag.value, 'base64url').toString())) {
                reply.status(401)
                return { error: "This contract code isn't whitelisted" }
            }
            const initStateTag = contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url"))
            const contractInitState = initStateTag ? Buffer.from(initStateTag.value, 'base64url').toString() : ''
            const simulationResult = await thirdEm.simulateContract({
                contractId: request.query.id,
                maybeContractSource: { contractType: 0, contractSrc: Buffer.from(contractCode) },
                interactions: [],
                contractInitState,
                maybeConfig: {
                    host: "127.0.0.1",
                    port: 8181,
                    protocol: "http",
                },
                maybeCache: false,
                maybeBundledContract: false,
                maybeSettings: null,
                maybeExmContext: {}

            })
            return {
                contractId: request.query.id,
                contractCode,
                contractInitState,
                simulationResult,
            }
        } catch (err) {
            console.error(err)
            reply.status(500)
            return { error: "Internal server error" }
        }
    })
}
