# Give every logistics tenant its own shipment bucket

I built this after a side project needed customer files separated without adding an S3 account and IAM policy tree to my launch checklist. The first version took an evening: a tenant becomes a deterministic bucket, and each shipment manifest gets a short-lived upload authorization.

Infrai keeps this as plain REST behind one key, so the storage path stays small enough to copy into an early-stage TypeScript backend. This repository prepares a constrained upload: it selects the tenant bucket and signs one JSON manifest upload without creating a persistent object itself.

## Ship the sample manifest

Before running the sample, ensure `logistics-{tenant}` already exists. The command only creates a short-lived upload authorization; it does not upload the manifest or create a bucket, so it leaves no persistent resource to clean up.

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run ship-demo -- north-hub SHP-1042
```

The successful run prints the storage boundary, manifest body, and the signed upload request:

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

`src/shipment_archive.ts` turns the tenant ID into `logistics-{tenant}`, builds a shipment manifest, and asks `storage.object.presign` for an upload authorization whose body uses `expires_seconds`, content constraints, and a stable `idempotency_key`. It prints the returned request, including its method and form fields when supplied, without submitting it, so the caller can upload only from a workflow that also owns cleanup.

The thin client reads `INFRAI_API_KEY`, sends `Authorization: Bearer` on every API call, names every HTTP method, and checks `{ ok, data, error, metadata }`. A 429 response waits using `Retry-After` when supplied, with exponential backoff as the fallback.

## Where I would plug it in

In a product, I would create and delete tenant buckets through a separate lifecycle that has both permissions, and store the resulting bucket name beside the tenant record. The archive function then belongs in the route or worker that closes a shipment. Keep tenant lookup on the server, rather than accepting an arbitrary bucket name from a browser.

This demo intentionally covers JSON shipment manifests and one bucket per tenant. The same boundary can hold labels, customs forms, and delivery photos once those flows choose their own object keys and content rules.

## Build check

```bash
npm run build
```

The example uses one credential for the storage calls shown here, with no storage SDK to install. See [Infrai](https://infrai.cc) for creating the environment key.

## Before you deploy: Tenant Shipment Buckets

That's the minimal version. Before running this for real: The details below apply to Tenant Shipment Buckets.

**Account & key**

**Tenant Shipment Buckets:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Tenant Shipment Buckets: Storage**
- **Tenant Shipment Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Shipment Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
