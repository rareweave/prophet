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
        try {
            const contractInitTxRes = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`);
            if (!contractInitTxRes.ok) {
                throw new Error(`Failed to fetch contract initialization transaction: ${contractInitTxRes.statusText}`);
            }
            const contractInitTx = await contractInitTxRes.json();
            const contractSrcTag = contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"));
            if (!contractSrcTag) {
                reply.status(404);
                return { error: "No contract found" };
            }
            const contractSrc = Buffer.from(contractSrcTag.value, "base64url").toString("utf8");
            if (!config.whitelistedCodes.includes(contractSrc)) {
                reply.status(403);
                return { error: "Code of this contract is not whitelisted for execution by this node" };
            }
            const contract = warp.contract(request.query.id);
            const evaluationResult = await contract.setEvaluationOptions({
                unsafeClient: "allow",
                waitForConfirmation: false,
                remoteStateSyncEnabled: false
            }).readState();
            const stateHash = await contract.getStateHash();
            let time = Date.now()
            return {
                status: "evaluated",
                contractTxId: request.query.id,
                state: evaluationResult.cachedValue.state,
                sortKey: evaluationResult.sortKey,
                timestamp: new Date(time).getFullYear() + '-' + new Date(time).getMonth() + '-' + new Date(time).getDay() + ' ' + new Date(time).getHours() + ':' + new Date(time).getMinutes() + ':' + new Date(time).getSeconds(),
                stateHash: stateHash
            };
        } catch (e) {
            console.error(`Error processing contract evaluation request: ${e.message}`);
            reply.status(500);
            return { error: "Internal server error" };
        }
    });
};
