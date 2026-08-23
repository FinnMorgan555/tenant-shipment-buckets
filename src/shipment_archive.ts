import { infrai } from "./infrai_storage.js";

function safeTenantId(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!slug || slug.startsWith("-") || slug.endsWith("-")) {
    throw new Error("Tenant ID must contain letters or numbers.");
  }
  return slug;
}

async function prepareShipmentUpload(tenantId: string, shipmentId: string): Promise<void> {
  const bucket = `logistics-${safeTenantId(tenantId)}`;
  const key = `shipments/${encodeURIComponent(shipmentId)}.json`;
  const manifest = JSON.stringify({ tenant_id: tenantId, shipment_id: shipmentId });
  const payload = new TextEncoder().encode(manifest);

  const signedUpload = await infrai.storage.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 600,
    content_type: "application/json",
    max_bytes: payload.byteLength,
    idempotency_key: `shipment-${safeTenantId(tenantId)}-${encodeURIComponent(shipmentId)}`,
  });

  console.log(
    JSON.stringify(
      {
        tenant_id: tenantId,
        bucket,
        key,
        manifest,
        upload: {
          url: signedUpload.url,
          method: signedUpload.method,
          headers: signedUpload.headers,
          fields: signedUpload.fields,
        },
      },
      null,
      2,
    ),
  );
}

const [tenantId, shipmentId] = process.argv.slice(2);
if (!tenantId || !shipmentId) {
  throw new Error("Run with a tenant ID and shipment ID.");
}

await prepareShipmentUpload(tenantId, shipmentId);
