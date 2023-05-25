const fp = require('fastify-plugin')
const config = require("json5").parse(require("fs").readFileSync("./config.json5"))
const Surreal = require("surrealdb.js")

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
module.exports = fp(async function (fastify, opts) {
    const db = new Surreal.default('http://' + config.dbSettings.host + '/rpc');
    await db.signin({
        user: config.dbSettings.user,
        pass: config.dbSettings.pass,
    });
    await db.use('prophet', 'prophet');

    fastify.decorate("db", db)
}, {
    name: 'surrealdb',
    dependencies: []
})
