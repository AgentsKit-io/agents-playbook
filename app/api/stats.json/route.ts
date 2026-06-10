import stats from '../../stats.snapshot.json'

/**
 * Canonical Playbook counts, served at https://playbook.agentskit.io/api/stats.json
 * for sibling ecosystem properties to consume. Derived from content by
 * scripts/compute-stats.mjs into the committed snapshot (regenerated at prebuild).
 */
export const dynamic = 'force-static'

export function GET() {
  return new Response(JSON.stringify(stats, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
