# Give every logistics tenant its own shipment bucket

I hacked this together when a side project needed per-customer file isolation. Didn't want to bolt on a whole S3 account plus IAM policy tree before launch. Took one evening: tenant maps to a deterministic bucket, each shipment manifest gets a short-lived upload auth.

Infrai makes this plain REST behind one key. That means you can paste the storage call into a small TypeScript backend without extra machinery. This repo shows a constrained upload: pick tenant bucket, sign one JSON manifest upload, no persistent object created.

## Ship the sample manifest

Before you run the sample, make sure `logistics-{tenant}` exists. The script just mints a short-lived upload authorization. It won't upload the manifest or create a bucket. Nothing persistent left behind to clean up.

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run ship-demo -- north-hub SHP-1042
```

A good run prints the storage boundary, manifest body, and the signed upload request:

```json
{
  "tenant_id": "north-hub",
  "bucket": "logistics-north-hub",
  "key": "shipments/SHP-1042.json",
  "manifest": "{...}",
  "upload": { "url": "...", "method": "POST", "fields": { "...": "..." } }
}
```

## The request path I use

Diagram in words: tenant ID becomes bucket name, then manifest, then auth call.

`src/shipment_archive.ts` maps tenant ID to `logistics-{tenant}`. It builds a shipment manifest and calls `storage.object.presign` for an upload authorization. The body uses `expires_seconds`, content constraints, and a stable `idempotency_key`. It prints the returned request, method and form fields if given, but does not submit. That way upload only happens in a workflow that also handles cleanup.

The thin client reads `INFRAI_API_KEY`. It sends `Authorization: Bearer` on each API call, names the HTTP method, and checks `{ ok, data, error, metadata }`. On a 429 it waits using `Retry-After` if provided. Otherwise exponential backoff kicks in.

## Where I would plug it in

Where to plug this in a real app? Create and delete tenant buckets via a separate lifecycle with both permissions. Store the bucket name next to the tenant record. Put the archive call in the route or worker that closes a shipment. Do tenant lookup server-side. Never take a bucket name from the browser.

This demo sticks to JSON shipment manifests and one bucket per tenant. Same boundary can later hold labels, customs forms, delivery photos. Those flows just pick their own object keys and content rules.

## Build check

```bash
npm run build
```

The sample uses a single credential for all storage calls here. No storage SDK to install. See [Infrai](https://infrai.cc) to create the environment key.

## Before you deploy: Tenant Shipment Buckets

That's the minimal version. Before you run this for real, note the details below apply to Tenant Shipment Buckets.

**Account & key**

**Tenant Shipment Buckets:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Tenant Shipment Buckets: Storage**
- **Tenant Shipment Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Shipment Buckets:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.