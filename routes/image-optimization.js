const { fetch } = require("undici")
const fs = require("fs")
const { createIPX, createIPXMiddleware, handleRequest } = require("ipx");
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {

    let ipx = createIPX({ domains: config.imageOptimizationDomains })
    fastify.get("/_ipx/*", async (req, resp) => {
        let ipxResponse = await handleRequest({ url: req.url.slice('/_ipx'.length), headers: req.headers }, ipx).catch(r => null)
        if (ipxResponse) {
            resp.headers(ipxResponse.headers)
            resp.code(ipxResponse.statusCode)
            return ipxResponse.body
        } else {
            return "Inavlid image"
        }
    })

}