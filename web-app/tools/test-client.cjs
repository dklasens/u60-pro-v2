const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function fixture() {
  const requests = []
  const context = { exports: {}, AbortController, setTimeout, clearTimeout,
    window: { location: { hostname: '192.168.0.1' }, dispatchEvent: () => {} },
    sessionStorage: { getItem: () => 'general-session-secret', setItem: () => {}, removeItem: () => {} },
    fetch: async (url, options) => {
      requests.push({ url, options })
      return { ok: true, status: 200, json: async () => ({ ok: true, data: {} }) }
    },
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/data/client.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context)
  return { client: context.exports, requests }
}
test('LAN confirmation carries only the scoped nonce to the new address', async () => {
  const { client, requests } = fixture()
  await client.confirmLan('192.168.2.1', 'single-use-nonce')
  assert.equal(requests[0].url, 'http://192.168.2.1:9090/api/router/lan/confirm')
  assert.equal(requests[0].options.headers.Authorization, undefined)
  assert.equal(JSON.parse(requests[0].options.body).token, 'single-use-nonce')
  await client.get('/api/device')
  assert.equal(requests[1].options.headers.Authorization, 'Bearer general-session-secret')
})
test('LAN confirmation rejects URLs and addresses outside private IPv4 space', async () => {
  const { client, requests } = fixture()
  for (const ip of ['8.8.8.8', '192.168.1.999', 'http://192.168.1.1', '192.168.1.1@example.org', '172.32.0.1']) {
    await assert.rejects(client.confirmLan(ip, 'nonce'), /Invalid LAN/)
  }
  assert.equal(requests.length, 0)
})
