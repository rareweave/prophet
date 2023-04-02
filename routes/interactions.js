const { fetch } = require("undici")
const fs = require("fs")
const { Readable } = require("stream")
const config = require("json5").parse(fs.readFileSync("./config.json5"))
module.exports = async function (fastify, opts) {
    fastify.get('/interactions/:id', async function (request, reply) {
        console.log(fastify.db)
        // let interactionsFromCache = await this.level.interactions.get(request.params.id).catch(e => [])
        // let since = interactionsFromCache.length ? interactionsFromCache[interactionsFromCache.length - 1]?.block : null

        // let interactionsFromGateway = await fetchInteractions(request.params.id, since)
        // let interactionsToPutInCache = interactionsFromGateway.filter(interaction => interaction.block && interaction.block.id != "PENDING")
        // await this.level.interaction.batch(interactionsToPutInCache.map(i => ({ type: "put", key: i.id, value: i })))
        // interactionsToPutInCache = interactionsToPutInCache.map(i => ({ id: i.id, block: i.block.height }))
        // await this.level.interactions.put(request.params.id, [...interactionsFromCache, ...new Map(interactionsToPutInCache.map(i => [i.id, i])).values()])

        // return {
        //     edges: [...new Map([...(await Promise.all(interactionsFromCache.map(i => this.level.interaction.get(i.id)))).map(i => [i.id, i]), ...interactionsFromGateway.map(i => [i.id, i])]).values()]
        // }
    })
}

async function fetchInteractions(id, since) {
    let pageInfo = { hasNextPage: true }
    let edges = []
    while (pageInfo.hasNextPage) {
        let gqlreply = await fetch('http://127.0.0.1:' + config.port + '/graphql', {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                query, variables: {
                    tags: [
                        { name: 'App-Name', values: ["SmartWeaveAction"] },
                        { name: 'Contract', values: [id] }
                    ],
                    blockFilter: { min: since, max: null },
                    first: 100,
                    after: edges.length ? edges[edges.length - 1].cursor : null
                }
            })
        }).then(res => res.json())

        pageInfo = gqlreply?.data.transactions.pageInfo
        edges.push(...gqlreply?.data.transactions.edges.map(edge => ({ ...edge, bundledIn: null, parent: null })))
    }
    return edges.map(edge => edge.node).sort(sortInteractions)
}

let query = `query Transactions(
  $tags: [TagFilter!]!
  $blockFilter: BlockFilter!
  $first: Int!
  $after: String
) {
  transactions(
    tags: $tags
    block: $blockFilter
    first: $first
    sort: HEIGHT_ASC
    after: $after
  ) {
    pageInfo {
      hasNextPage
    }
    edges {
      node {
        id
        owner {
          address
        }
        recipient
        tags {
          name
          value
        }
        block {
          height
          id
          timestamp
        }
        fee {
          winston
        }
        quantity {
          winston
        }
        parent {
          id
        }
        bundledIn {
          id
        }
      }
      cursor
    }
  }
}
`

function sortInteractions(interaction1, interaction2) {
    if (interaction1.block.height == interaction2.block.height) {
        let nonce1 = interaction1.tags.find(tag => tag.name == "Nonce" || tag.name == "Sequencer-Mills")?.value || "0"
        let nonce2 = interaction1.tags.find(tag => tag.name == "Nonce" || tag.name == "Sequencer-Mills")?.value || "0"
        return nonce1 - nonce2
    }
    else {
        return interaction1.block.height - interaction2.block.height
    }
}