const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const crypto = require("crypto")
const thirdEm = require("@three-em/node/index")
const { fetch } = require('undici')
const Arweave = require("arweave")
const arweave = Arweave.init({
    host: "127.0.0.1",
    port: config.port,
    protocol: "http"
})
module.exports = fp(async function (fastify, opts) {
    // let networkInfo = await fetch('http://127.0.0.1:' + config.port + "/info").then(res => res.json())
    setInterval(async function updateInteractions() {
        networkInfo = await fetch(config.arweaveGateway + "/info").catch(e => ({ json: () => null })).then(res => res.json())
        let contractsToBeUpdated = (await fastify.db.query("SELECT contractId FROM indexedContracts WHERE lastUpdateBlock < $currentHeight", { currentHeight: networkInfo?.height }))[0].result
        console.log(contractsToBeUpdated)
        console.log("Network info", networkInfo)
    }, 10000)
    // console.log("Network info", networkInfo)
}, {
    name: 'interactionSync',
    dependencies: ['lmdb']
})