const { fetch } = require("undici");
const fs = require("fs");
const { Readable } = require("stream");
const config = require("json5").parse(fs.readFileSync("./config.json5"));
module.exports = async function (fastify, opts) {
  fastify.get('/:id', async function (request, reply) {
    try {
      const tx = await fetch(config.arweaveGateway + "/" + request.params.id);
      if (![200, 202].includes(tx.status)) {
        throw new Error("Invalid status from gateway");
      }
      reply.raw.writeHead(tx.status, tx.headers);
      Readable.from(tx.body).pipe(reply.raw);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
};
