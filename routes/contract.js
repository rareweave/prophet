

const fs = require("fs")
const { fetch } = require("undici")
const Arweave = require("arweave")
const Account = require("arweave-account");
const { WarpFactory, ContractDefinitionLoader } = require("warp-contracts")
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
    const warp = WarpFactory.forMainnet({

        inMemory: true,
    }, false, arweave)
    warp.definitionLoader.baseUrl = `http://127.0.0.1:${config.port}`
    warp.interactionsLoader.delegate.baseUrl = `http://127.0.0.1/:${config.port}`


    fastify.get('/gateway/contract', async function (request, reply) {
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
    fastify.get('/index', async function (request, reply) {

        if (!request.query.id) {
            reply.status(404)
            return { error: "No contract specified" }
        }
        reply.send("Scheduled")



        let cache = (await fastify.db.select("nfts:`" + request.query.id + "`").catch(e => { console.log(e); return [] }))[0]

        if (!cache) {
            let contractInitTx = await fetch(`http://127.0.0.1:${config.port}/tx/${request.query.id}`).then(res => res.json()).catch(e => null)
            if (!contractInitTx || contractInitTx.error || !contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url"))) {

                return
            }
            if (!config.nftSrcIds.includes(Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString())) {

                return
            }
            let contractInfo = await fetch(`http://127.0.0.1:${config.port}/gateway/contract?txId=${request.query.id}`).then(res => res.json()).catch(e => console.log(e))       // let contractInfo = await fastify.db.select("contractInfo:" + request.query.contractId).catch(e => null)

            let contractInstance = warp.contract(request.query.id).setEvaluationOptions({
                unsafeClient: "allow", waitForConfirmation: false,
            });
            let state = (await contractInstance.readState()).cachedValue.state
            let ownerMetaweaveAccount = await accountTools.get(state.owner)
            let ownerAnsName = (await fetch(`https://ans-resolver.herokuapp.com/resolve/${ownerMetaweaveAccount.addr}`).then(res => res.json()))?.domain

            await fastify.db.create("nfts:`" + request.query.id + "`", {
                "status": "evaluated",
                contractTxId: request.query.id,
                manifest: contractInfo.manifest,
                state,
                owner: { address: ownerMetaweaveAccount.addr, account: ownerMetaweaveAccount, ansName: ownerAnsName },

                sourceId: Buffer.from(contractInitTx.tags.find(tag => tag.name == Buffer.from("Contract-Src").toString("base64url")).value, 'base64url').toString(),
                timestamp: Date.now()
            })
        } else if ((Date.now() - cache?.timestamp) > 300000) {
            let contractInfo = await fetch(`http://127.0.0.1:${config.port}/gateway/contract?txId=${request.query.id}`).then(res => res.json()).catch(e => console.log(e))       // let contractInfo = await fastify.db.select("contractInfo:" + request.query.contractId).catch(e => null)

            let contractInstance = warp.contract(request.query.id).setEvaluationOptions({
                unsafeClient: "allow", waitForConfirmation: false,
            });
            let state = (await contractInstance.readState()).cachedValue.state
            let ownerMetaweaveAccount = await accountTools.get(state.owner)
            let ownerAnsName = (await fetch(`https://ans-resolver.herokuapp.com/resolve/${ownerMetaweaveAccount.addr}`).then(res => res.json()))?.domain

            await fastify.db.update("nfts:`" + request.query.id + "`", {
                "status": "evaluated",
                contractTxId: request.query.id,
                manifest: contractInfo.manifest,
                owner: { address: ownerMetaweaveAccount.addr, account: ownerMetaweaveAccount, ansName: ownerAnsName },

                state,
                sourceId: contractInfo.srcTxId,
                timestamp: Date.now()
            })
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
            interactions: interactions.reverse()
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
