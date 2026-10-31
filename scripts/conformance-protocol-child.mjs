// Child process for `pnpm conformance`: decodes the shared AgentsKit Chat turn
// fixtures with the shared protocol decoder. Prints JSON {failures: string[]}.
import { decodeTurnEvent } from '@agentskit/chat/protocol'
import { invalidTurnEventFixtures, validTurnEventFixtures } from '@agentskit/chat/protocol/fixtures'

const failures = []
if (validTurnEventFixtures.length === 0 || invalidTurnEventFixtures.length === 0) failures.push('shared fixtures are empty')
for (const fixture of validTurnEventFixtures) {
  const result = decodeTurnEvent(fixture.event)
  if (!result.ok) failures.push(`valid fixture "${fixture.name}" did not decode`)
}
for (const fixture of invalidTurnEventFixtures) {
  const result = decodeTurnEvent(fixture.event)
  if (result.ok) failures.push(`invalid fixture "${fixture.name}" decoded`)
  else if (result.diagnostic?.code !== fixture.code) failures.push(`invalid fixture "${fixture.name}": expected ${fixture.code}, got ${result.diagnostic?.code}`)
}
process.stdout.write(`${JSON.stringify({ failures })}\n`)
