const { fetch } = require("undici");
const fs = require("fs");
const { Readable } = require("stream");
const config = require("json5").parse(fs.readFileSync("./config.json5"));

module.exports = async function (fastify, opts) {
    fastify.get("/tx/:id", async function (request, reply) {
        try {
            const gqlreply = await fetch("http://localhost:" + config.port + "/graphql", {
                method: "POST",
                headers: { "Content-type": "application/json" },
                body: JSON.stringify({
                    operationName: null,
                    query: `query {
              transaction(id: "${request.params.id}") {
                  id
                  signature
                  recipient
                  owner {
                      address
                      key
                  }
                  fee {
                      winston
                      ar
                  }
                  quantity {
                      winston
                      ar
                  }
                  data {
                      size
                      type
                  }
                  tags {
                      name
                      value
                  }
                  block {
                      id
                      timestamp
                      height
                      previous
                  }
                  parent {
                      id
                  }
              }
          }`,
                    variables: {},
                }),
            });

            const gqlData = await gqlreply.json();
            const txheaders = gqlData?.data?.transaction;

            if (!txheaders || !txheaders.id) {
                const contractTxFromWarp = await fetch(`https://gateway.warp.cc/gateway/contract?txId=${request.params.id}`);

                if (!contractTxFromWarp.ok) {
                    reply.status(404);
                    return { error: "Tx not found" };
                }

                const txFromWarpContent = await contractTxFromWarp.json();
                return txFromWarpContent.contractTx;
            }

            return {
                format: 2,
                id: txheaders.id,
                last_tx: "",
                owner: txheaders.owner.key,
                signature: txheaders.signature,
                target: txheaders.recipient,
                data: "",
                quantity: txheaders.quantity.winston,
                data_size: txheaders.data.size,
                data_tree: [],
                data_root: "",
                tags: encodeTags(txheaders.tags),
                reward: txheaders.fee.winston,
            };
        } catch (err) {
            console.error(err);
            reply.status(500);
            return { error: "Internal server error" };
        }
    });
};

function encodeTags(tags) {
    return tags.map((tag) => ({
        name: Buffer.from(tag.name).toString("base64url"),
        value: Buffer.from(tag.value).toString("base64url"),
    }));
}
