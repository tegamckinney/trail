const { notFound } = require('boom')
const S = require('fluent-schema')

const { errorsSchemas } = require('../schemas/errors')
const { spec, trailSchema } = require('../schemas/trails')
const { failAction, validationOptions } = require('../validation')
const { addApiRoute, generateSpec } = require('../api')

module.exports = async function (fastify, options, done) {
  for (const url of ['/trails/openapi.json', '/trails/swagger.json']) {
    fastify.route({
      method: 'GET',
      url,
      handler (request, reply) {
        return reply.send(spec)
      }
    })
  }

  addApiRoute(fastify, 'trails', {
    method: 'GET',
    url: '/trails',
    async handler (request, reply) {
      const { from, to, who, what, subject, page, pageSize, sort } = request.query

      const results = await request.trailCore.search({ from, to, who, what, subject, page, pageSize, sort })
      reply.send(results)
    },
      // See https://www.fastify.io/docs/latest/Validation-and-Serialization/#error-handling
      schema: {
          query: trailSchema.search,
          response: S.array()
            .description('The search results.')
          .items(trailSchema.response)
      },
    config: {
      description: 'Search audit trails.',
      tags: ['api', 'trails'],
      validate: {
        query: trailSchema.search,
        failAction,
        options: validationOptions
      },
      response: {
        status: {
          200: S.array()
            .description('The search results.')
            .items(trailSchema.response),
          422: errorsSchemas['422'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  addApiRoute(fastify, 'trails', {
    method: 'GET',
    url: '/trails/enumerate',
    async handler (request, reply) {
      const { from, to, type, page, pageSize, desc } = request.query

      const results = await request.trailCore.enumerate({ from, to, type, page, pageSize, desc })
      reply.send(results)
    },
    config: {
      description: 'Enumerate audit trails ids.',
      tags: ['api', 'trails'],
      validate: {
        query: trailSchema.enumerate,
        failAction,
        options: validationOptions
      },
      response: {
        status: {
          200: S.array()
            .description('The enumeration results.')
            .items(S.string().description('A trail who, what or subject id')),
          422: errorsSchemas['422'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  addApiRoute(fastify, 'trails', {
    method: 'POST',
    url: '/trails',
    async handler (request, reply) {
      const id = await request.trailCore.insert(request.payload)
      const trail = await request.trailCore.get(id)

      reply.code = 201
      reply.send(trail)
    },
    config: {
      description: 'Create a new audit trail.',
      tags: ['api', 'trails'],
      validate: {
        headers: S.object()
          .prop('content-type', S.string().valid('application/json'))
          .additionalProperties(true),
        payload: trailSchema.request,
        failAction,
        options: validationOptions
      },
      response: {
        status: {
          201: trailSchema.response.description('The newly created audit trail.'),
          400: errorsSchemas['400'],
          422: errorsSchemas['422'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  addApiRoute(fastify, 'trails', {
    method: 'GET',
    url: '/trails/{id}',
    async handler (request, reply) {
      const { id } = request.params
      const trail = await request.trailCore.get(id)

      if (!trail) throw notFound(`Trail with id ${id} not found.`)

      return reply.send(trail)
    },
    config: {
      auth: false,
      description: 'Get a audit trail.',
      tags: ['api', 'trails'],
      validate: {
        params: {
          id: trailSchema.params.id
        }
      },
      response: {
        status: {
          200: trailSchema.response.description('The requested audit trail.'),
          400: errorsSchemas['400'],
          404: errorsSchemas['404'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  addApiRoute(fastify, 'trails', {
    method: 'PUT',
    url: '/trails/{id}',
    async handler (request, reply) {
      const { id } = request.params
      const updated = await request.trailCore.update(id, request.payload)

      if (!updated) throw notFound(`Trail with id ${id} not found.`)

      const trail = await request.trailCore.get(id)
      reply.code = 202
      reply.send(trail)
    },
    config: {
      auth: false,
      description: 'Update a audit trail.',
      tags: ['api', 'trails'],
      validate: {
        headers: S.object()
          .prop('content-type', S.string().valid('application/json'))
          .additionalProperties(true),
        params: {
          id: trailSchema.params.id
        },
        payload: trailSchema.request
      },
      response: {
        status: {
          202: trailSchema.response.description('The updated audit trail.'),
          400: errorsSchemas['400'],
          404: errorsSchemas['404'],
          422: errorsSchemas['422'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  addApiRoute(fastify, 'trails', {
    method: 'DELETE',
    url: '/trails/{id}',
    async handler (request, reply) {
      const { id } = request.params
      const deleted = await request.trailCore.delete(id)

      if (!deleted) throw notFound(`Trail with id ${id} not found.`)

      reply.code = 204
      reply.send()
    },
    config: {
      auth: false,
      description: 'Delete a audit trail.',
      tags: ['api', 'trails'],
      validate: {
        params: {
          id: trailSchema.params.id
        }
      },
      response: {
        status: {
          // TODO Confirm if this correctly defines an empty response? (Maybe use null() instead?)
          204: S.object().additionalProperties(false).description('The trail has been deleted successfully.'),
          400: errorsSchemas['400'],
          404: errorsSchemas['404'],
          500: errorsSchemas['500']
        }
      }
    }
  })

  // Add tagged routes to the swagger.json
  generateSpec(spec, 'trails')

  done()
}