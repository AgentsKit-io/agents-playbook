// OpenNext for Cloudflare Workers. See wrangler.jsonc.
// Static-assets incremental cache: prerendered pages/route handlers are served from the Worker's
// assets, so deploys need no KV writes (the KV free tier allows 1,000 writes/day; each deploy
// would write every prerendered page). Nothing here relies on ISR revalidation.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
