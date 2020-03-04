/*
 * @adonisjs/shield
 *
 * (c) ? (Please advice before merge, thanks!)
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import test from 'japa'
import Tokens from 'csrf'
import { csrf } from '../src/csrf'
import { getCtxWithSession, getCtxFromIncomingMessage, getCsrfMiddlewareInstance } from '../test-helpers'

const Csrf = new Tokens()
const APPLICATION_SECRET_KEY = 'secret-key'

test.group('Csrf', () => {
  test('return noop function when enabled is false', async (assert) => {
    const middlewareFn = csrf({ enabled: false }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession()
    middlewareFn(ctx)

    assert.isUndefined(ctx.request.csrfToken)
  })

  test('generate new, and valid csrf token for every new request', async (assert) => {
    const csrfMiddleware = await getCsrfMiddlewareInstance({ enabled: true }, APPLICATION_SECRET_KEY)

    const TEST_CSRF_SECRET = await csrfMiddleware.getCsrfSecret()
    const TEST_CSRF_TOKEN = csrfMiddleware.generateCsrfToken(TEST_CSRF_SECRET)

    const ctx = await getCtxFromIncomingMessage({
      'x-csrf-token': TEST_CSRF_TOKEN,
    })

    ctx.session.put('csrf-secret', csrfMiddleware.session.get('csrf-secret'))

    const middlewareFn = csrf({ enabled: true }, APPLICATION_SECRET_KEY)

    ctx.request.request.method = 'GET'

    await middlewareFn(ctx)

    assert.isDefined(ctx.request.csrfToken)
    assert.isTrue(Csrf.verify(TEST_CSRF_SECRET, ctx.request.csrfToken))
  })

  test('validate csrf token on a request', async (assert) => {
    assert.plan(1)

    const middlewareFn = csrf({ enabled: true }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession()

    ctx.request.request.method = 'POST'

    try {
      await middlewareFn(ctx)
    } catch (error) {
      assert.equal(error.message, 'E_BAD_CSRF_TOKEN: Invalid CSRF Token')
    }
  })

  test('skip csrf token validation on methods white listed', async (assert) => {
    const middlewareFn = csrf({ enabled: true, methods: ['POST', 'PATCH', 'DELETE'] }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession('/users/:id', { id: 12453 })

    ctx.request.request.method = 'PUT'

    await middlewareFn(ctx)

    assert.isDefined(ctx.request.csrfToken)
  })

  test('enforces csrf token validation on methods not whitelisted', async (assert) => {
    assert.plan(1)
    const middlewareFn = csrf({ enabled: true, methods: ['POST', 'PATCH', 'DELETE'] }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession('/users/:id', { id: 12453 })

    ctx.request.request.method = 'PATCH'

    try {
      await middlewareFn(ctx)
    } catch (error) {
      assert.equal(error.message, 'E_BAD_CSRF_TOKEN: Invalid CSRF Token')
    }
  })

  test('skip csrf token validation on uris white listed', async (assert) => {
    assert.plan(1)
    const middlewareFn = csrf({ enabled: true, filterUris: ['/users/:id'] }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession('/users/:id', { id: 12453 })

    ctx.request.request.method = 'PATCH'

    await middlewareFn(ctx)

    assert.isDefined(ctx.request.csrfToken)
  })

  test('enforces csrf token validation on uris not whitelisted', async (assert) => {
    assert.plan(2)
    const middlewareFn = csrf({ enabled: true, filterUris: ['posts/:post/store'] }, APPLICATION_SECRET_KEY)
    const ctx = await getCtxWithSession('/users/:id', { id: 12453 })

    ctx.request.request.method = 'PATCH'

    try {
      await middlewareFn(ctx)
    } catch (error) {
      assert.isUndefined(ctx.request.csrfToken)
      assert.equal(error.message, 'E_BAD_CSRF_TOKEN: Invalid CSRF Token')
    }
  })
})
