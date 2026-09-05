const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture() {
  const timers = new Map()
  let timerId = 0
  const context = { exports: {}, Error,
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId },
    clearTimeout: (id) => timers.delete(id),
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/data/pollScheduler.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  const values = [], requests = [], errors = []
  let visible = true
  const poll = new context.exports.PollScheduler({
    read: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    publish: (v) => values.push(v), error: (e) => errors.push(e), refreshing: () => {},
    interval: () => 3000, visible: () => visible,
  })
  return { poll, timers, values, requests, errors,
    visibility: (value) => { visible = value; poll.wake() },
    fire: () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn() },
  }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('visibility changes during a request retain exactly one timer', async () => {
  const f = fixture()
  f.poll.start()
  for (let i = 0; i < 10; i++) { f.visibility(false); f.visibility(true) }
  assert.equal(f.requests.length, 1)
  f.requests[0].resolve('first')
  await settle()
  assert.equal(f.timers.size, 1)
  f.fire()
  assert.equal(f.requests.length, 2)
  f.poll.stop()
})

test('mutation wins over an older in-flight response', async () => {
  const f = fixture()
  f.poll.start()
  f.poll.mutate('authoritative')
  f.requests[0].resolve('obsolete')
  await settle()
  assert.deepEqual(f.values, ['authoritative'])
  f.poll.stop()
})

test('unmounted poll cannot publish, report errors or reschedule', async () => {
  const f = fixture()
  f.poll.start()
  f.poll.stop()
  f.requests[0].reject(new Error('old failure'))
  await settle()
  assert.deepEqual(f.errors, [])
  assert.equal(f.timers.size, 0)
})

test('refresh during a request queues one new read and discards old result', async () => {
  const f = fixture()
  f.poll.start()
  f.poll.refresh()
  f.poll.refresh()
  f.requests[0].resolve('old')
  await settle()
  assert.deepEqual(f.values, [])
  assert.equal(f.timers.size, 1)
  f.fire()
  assert.equal(f.requests.length, 2)
  f.requests[1].resolve('new')
  await settle()
  assert.deepEqual(f.values, ['new'])
  f.visibility(false)
  assert.equal(f.timers.size, 0)
  f.poll.stop()
})
