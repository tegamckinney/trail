const { TrailsManager } = require('@nearform/trail-core')
const { get } = require('lodash')

const { errorsMessages } = require('./schemas/errors')

const environment = get(process, 'env.NODE_ENV', 'development')

// TODO is this needed?
const formatReasons = error => {}

const formatStack = error => get(error, 'stack', '').filter((s, i) => i > 0).split('\n').map(s => s.trim().replace(/^at /, ''))

module.exports = async function (fastify, options, done) {
  const whitelistedErrors = [404]
  // TODO options.pool - may need a wrapper function which is passed the trails config and returns the plugin
  const trailsManager = new TrailsManager(undefined, options.pool)

  fastify.decorate('trailCore', trailsManager)
  fastify.decorateReply('trailCore', trailsManager)

  fastify.addHook('onError', (request, reply, error, done) => {
    // TODO review following
    const code = error.isBoom ? error.output.statusCode : error.statusCode

    if (
      !error.isTrail && error.message !== 'Invalid request payload JSON format' &&
        (code < 400 || whitelistedErrors.includes(code))
    ) return done() // No error or a error we don't want to manage, we're fine

    // Body was an invalid JSON
    if (error.message === 'Invalid request payload JSON format') {
      error.message = errorsMessages['json.format']
      error.reformat()
    } else if (code === 422) { // Validation errors
      error.output.payload.reasons = formatReasons(error)
    } else if (code === 500 && environment !== 'production') { // Add the stack
      error.output.payload.message = `[${error.code || error.name}] ${error.message}`
      error.output.payload.stack = formatStack(error)
    }

    done()
  })

  fastify.addHook('onClose', async (instance, done) => {
    await trailsManager.close()
    done()
  })

  await fastify.register(require('./routes/trails'))
}

/*
exports.plugin = {
  pkg: require('../package'),

  register: async (server, options) => {
    const whitelistedErrors = [404]
    const trailsManager = new TrailsManager(undefined, options.pool)

    server.decorate('server', 'trailCore', trailsManager)
    server.decorate('request', 'trailCore', trailsManager)

    server.ext('onPreResponse', (request, h) => {
      const error = request.response
      const code = error.isBoom ? error.output.statusCode : error.statusCode

      if (
        !error.isTrail && error.message !== 'Invalid request payload JSON format' &&
        (code < 400 || whitelistedErrors.includes(code))
      ) return h.continue // No error or a error we don't want to manage, we're fine

      // Body was an invalid JSON
      if (error.message === 'Invalid request payload JSON format') {
        error.message = errorsMessages['json.format']
        error.reformat()
      } else if (code === 422) { // Validation errors
        error.output.payload.reasons = formatReasons(error)
      } else if (code === 500 && environment !== 'production') { // Add the stack
        error.output.payload.message = `[${error.code || error.name}] ${error.message}`
        error.output.payload.stack = formatStack(error)
      }

      return h.continue
    })

    server.ext('onPostStop', async () => {
      await trailsManager.close()
    })

    await server.register(require('./routes/trails'))
  }
}
*/