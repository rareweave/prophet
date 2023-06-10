

const fs = require("fs")
const Arweave = require("arweave")
const Account = require("arweave-account");
const { WarpFactory, ContractDefinitionLoader, defaultCacheOptions, LoggerFactory } = require("warp-contracts")
const { LmdbCache } = require("warp-contracts-lmdb");
const config = require("json5").parse(fs.readFileSync("./config.json5"))
const arweave = Arweave.init({
    host: "127.0.0.1",
    port: config.port,
    protocol: "http"
})

module.exports = async function (fastify, opts) {
    const accountTools = new Account.default({
        cacheIsActivated: true,
        cacheSize: 100,
        cacheTime: 60,
        gateway: {
            host: "127.0.0.1",
            port: config.port,
            protocol: "http"
        }
    })
    const warp = WarpFactory.forMainnet(defaultCacheOptions, false, arweave)
        .useStateCache(new LmdbCache({
            ...defaultCacheOptions,
            dbLocation: `./warp-cache/state`
        }, {
            maxEntriesPerContract: 100,
            minEntriesPerContract: 10
        }
        ))
        .useContractCache(
            // Contract cache
            new LmdbCache({
                ...defaultCacheOptions,
                dbLocation: `./warp-cache/contracts`
            }),
            // Source cache
            new LmdbCache({
                ...defaultCacheOptions,
                dbLocation: `./warp-cache/src`
            }));
    LoggerFactory.INST.logLevel("fatal")
    warp.definitionLoader.baseUrl = `http://localhost:${config.port}`
    warp.interactionsLoader.delegate.baseUrl = `http://localhost:${config.port}`


    fastify.get('/gateway/contract', async function (request, reply) {
        if (!request.query.txId) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        let contractInitTx = await fastify.fetch(`http://127.0.0.1:${config.port}/tx/${request.query.txId}`).then(res => res.json()).catch(e => console.log(e))

        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {
            reply.status(404)
            return { error: "No contract found" }
        }
        if (!config.whitelistedCodes.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {
            reply.status(401)
            return { error: "This contract code isn't whitelisted" }
        }
        let initState = contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url"))?.value ?
            JSON.parse(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Init-State").toString("base64url"))?.value, 'base64url').toString()) :
            await fetch(`http://127.0.0.1:${config.port}/${request.query.txId}`).then(res => res.json()).catch(e => null)

        let contractCodeTx = await fastify.fetch(`http://127.0.0.1:${config.port}/tx/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.json()).catch(e => console.log(e))

        let contractCode = await fastify.fetch(`http://127.0.0.1:${config.port}/${Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()}`).then(res => res.text()).catch(e => console.log(e))
        // let contractInfo = await fastify.db.select("contractInfo:" + request.query.contractId).catch(e => null)
        fastify.db.query(`INSERT INTO indexedContracts $contractInfo;`, {
            contractInfo: {
                lastUpdateBlock: 0,
                id: "indexedContracts:`" + request.query.txId + "`",
                contractId: request.query.txId,
                srcTxId: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()
            }
        })

        return {
            bundlerTxId: null,
            contractTx: { tags: contractInitTx.tags },
            initState,
            manifest: contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Manifest").toString("base64url")) ?
                JSON.parse(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Manifest").toString("base64url")).value, 'base64url').toString()) : null,
            txId: request.query.txId,
            src: contractCode,
            srcTx: contractCodeTx,
            srcTxId: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()
        }
    })
    fastify.get('/index', async function (request, reply) {

        if (!request.query.id) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        reply.send("Scheduled")
        let contractInitTx = await fastify.fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`).then(res => res.json()).catch(e => null)
        if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {

            return
        }
        let codeId = Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString()
        console.log(config.nftSrcIds, codeId)
        if (config.nftSrcIds.includes(codeId)) {
            await fastify.timedCache(request.query.id, "nfts", async () => {

                let contractInfo = await fastify.fetch(`http://127.0.0.1:${config.port}/gateway/contract?txId=${request.query.id}`).then(res => res.json()).catch(e => console.log(e))       // let contractInfo = await fastify.db.select("contractInfo:" + request.query.contractId).catch(e => null)

                let contractInstance = warp.contract(request.query.id).setEvaluationOptions({
                    unsafeClient: "allow", waitForConfirmation: false,
                });
                let state = (await contractInstance.readState()).cachedValue.state
                let ownerMetaweaveAccount = await accountTools.get(state.owner).catch(e => null)
                let ownerAnsName = (await fastify.fetch(`https://ans-resolver.herokuapp.com/resolve/${state.owner}`).catch(e => ({ domain: null })).then(res => res.json()))?.domain

                return {
                    "status": "evaluated",
                    contractTxId: request.query.id,
                    manifest: contractInfo.manifest,
                    state,
                    owner: { address: state.owner, account: ownerMetaweaveAccount, ansName: ownerAnsName },

                    sourceId: codeId,

                }
            }, 300000)

        }
    })

    fastify.get('/contract', async (request, reply) => {
        if (!request.query.id) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        return await fastify.timedCache(request.query.id, "contract", async () => {
            let contractInfo = await fastify.fetch(`http://127.0.0.1:${config.port}/gateway/contract?txId=${request.query.id}`).then(res => res.json()).catch(e => console.log(e))
            if (!contractInfo) { return "Error fetching contract" }
            let contractInstance = warp.contract(request.query.id).setEvaluationOptions({
                unsafeClient: "allow", waitForConfirmation: false,
            });
            let state = await contractInstance.readState()
            return {
                "status": "evaluated",
                contractTxId: request.query.id,
                manifest: contractInfo.manifest,
                state: state.cachedValue.state,
                sortKey: state.sortKey,
                stateHash: await contractInstance.stateHash(state.cachedValue.state),
                sourceId: contractInfo.srcTxId,

            }
        }, 20000)


    })

}
