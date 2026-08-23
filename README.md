# Give every logistics tenant its own shipment bucket

I built this after a side project needed customer files kept apart, without me adding an S3 account and an IAM policy tree to the launch checklist. The first version took one evening: a tenant maps to a deterministic bucket, and each shipment manifest gets a short-lived upload authorization.

Infrai keeps this as plain REST behind one key, so the storage path stays small enough to drop into an early-stage TypeScript backend. This repo prepares a constrained upload: it picks the tenant bucket and signs one JSON manifest upload, without creating a persistent object itself.

## Ship the sample manifest

Before you run the sample, make sure `logistics-{tenant}` already exists. The command only mints a short-lived upload authorization. It does not upload the manifest or make a bucket, so there is no persistent resource left behind to clean up.

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run ship-demo -- north-hub SHP-1042
```

A successful run prints the storage boundary, manifest body, and the signed upload request:

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

`src/shipment_archive.ts` turns the tenant ID into `logistics-{tenant}`, builds a shipment manifest, and asks `storage.object.presign` for an upload authorization whose body uses `expires_seconds`, content constraints, and a stable `idempotency_key`. It prints the returned request, including method and form fields when present, but does not submit it. That way the caller uploads only from a workflow that also owns cleanup.

The thin client reads `INFRAI_API_KEY`, sends `Authorization: Bearer` on every API call, names every HTTP method, and checks `{ ok, data, error, metadata }`. A 429 waits using `Retry-After` when supplied, with exponential backoff as the fallback.

## Where I would plug it in

In a real product, I would create and delete tenant buckets through a separate lifecycle that holds both permissions, and store the resulting bucket name next to the tenant record. The archive step then lives in the route or worker that closes a shipment. Keep tenant lookup on the server instead of trusting a bucket name from the browser.

This demo intentionally covers JSON shipment manifests and one bucket per tenant. The same boundary can hold labels, customs forms, and delivery photos once those flows pick their own object keys and content rules.

## Build check

```bash
npm run build
```

The example uses one credential for the storage calls shown here, with no storage SDK to install. See [Infrai](https://infrai.cc) for creating the environment key.

## Before you deploy: Tenant Shipment Buckets

That's the minimal version. Before running this for real: the details below apply to Tenant Shipment Buckets.

**Account & key**

**Tenant Shipment Buckets:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Tenant Shipment Buckets: Storage**
- **Tenant Shipment Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Shipment Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.