// Shared lifecycle fixture: start -> stream -> cancel -> cleanup.
// Exits 0 only when the contract holds: cancellation stops the stream promptly,
// cleanup runs exactly once, and no chunk is delivered after cancel.
import assert from 'node:assert/strict'

const events = []
let cleanups = 0

async function* source(signal) {
  events.push('start')
  try {
    for (let i = 0; ; i += 1) {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, 5))
      yield `chunk-${i}`
    }
  } finally {
    cleanups += 1
    events.push('cleanup')
  }
}

const controller = new AbortController()
const received = []
for await (const chunk of source(controller.signal)) {
  received.push(chunk)
  events.push('stream')
  if (received.length === 3) {
    controller.abort()
    events.push('cancel')
  }
}

assert.equal(received.length, 3, 'no chunk may be delivered after cancel')
assert.equal(cleanups, 1, 'cleanup must run exactly once')
assert.deepEqual(events, ['start', 'stream', 'stream', 'stream', 'cancel', 'cleanup'])
console.log('lifecycle fixture ok')
