

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
const warp = WarpFactory.forMainnet({
    inMemory: true,
}, true, arweave)
module.exports = async function (fastify, opts) {

    fastify.get('/contract', async function (request, reply) {
        let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`).then(res => res.json()).catch(e => null)
        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
            reply.status(404)
            return { error: "No contract found" }
        }

        if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(c => c.name == Buffer.from("Contract-Src").toString("base64url")).value, "base64url").toString("utf8"))) {
            reply.status(403)
            return { error: "Code of this contract is not whitelisted for execution by this node" }
        }
        let contract = warp.contract(request.query.id)
        let evalutionResult = await (contract.setEvaluationOptions({
            unsafeClient: "allow", waitForConfirmation: false, //we are using anchoring
            remoteStateSyncEnabled: false
        })).readState()
        let time = Date.now()
        return { "status": "evaluated", contractTxId: request.query.id, state: evalutionResult.cachedValue.state, sortKey: evalutionResult.sortKey, timestamp: new Date(time).toDateString(), stateHash: contract.stateHash }
    })
}
