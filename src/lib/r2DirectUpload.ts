/**
 * Browser & Node.js Universal Client-Side R2 Direct Uploader for Nedelje
 * Uses Web Crypto API (SubtleCrypto) for zero external dependencies
 */

const ACCOUNT_ID = "988f40900512ba0fb55a34e0bbfc7ab3";
const ACCESS_KEY_ID = "e96fc3fc5a766c5a05c6c88d17cadeb4";
const SECRET_ACCESS_KEY = "7b4f0541e4bae492fcb973235e1f39b3511c21a94e44ee805dc377dfedf7375a";
const BUCKET_NAME = "kck-media";
const REGION = "auto";

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string | Uint8Array): Promise<ArrayBuffer> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis as any).crypto;
  const cryptoKey = await cryptoObj.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const dataBuf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return await cryptoObj.subtle.sign("HMAC", cryptoKey, dataBuf);
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis as any).crypto;
  const hash = await cryptoObj.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function directUploadToR2(file: File | Blob, r2Path: string, contentType?: string): Promise<boolean> {
  try {
    const arrayBuf = await file.arrayBuffer();
    const payloadHash = await sha256Hex(arrayBuf);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${BUCKET_NAME}/${r2Path.startsWith("/") ? r2Path.slice(1) : r2Path}`;
    const mime = contentType || file.type || "application/octet-stream";

    const canonicalHeaders =
      `content-type:${mime}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest =
      `PUT\n` +
      `${canonicalUri}\n` +
      `\n` +
      `${canonicalHeaders}\n` +
      `${signedHeaders}\n` +
      `${payloadHash}`;

    const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${REGION}/s3/aws4_request`;

    const stringToSign =
      `${algorithm}\n` +
      `${amzDate}\n` +
      `${credentialScope}\n` +
      `${canonicalRequestHash}`;

    // Derive signing key
    const kSecret = new TextEncoder().encode("AWS4" + SECRET_ACCESS_KEY);
    const kDate = await hmacSha256(kSecret, dateStamp);
    const kRegion = await hmacSha256(kDate, REGION);
    const kService = await hmacSha256(kRegion, "s3");
    const kSigning = await hmacSha256(kService, "aws4_request");

    const signatureBuf = await hmacSha256(kSigning, stringToSign);
    const signature = bufToHex(signatureBuf);

    const authorizationHeader =
      `${algorithm} ` +
      `Credential=${ACCESS_KEY_ID}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    const url = `https://${host}${canonicalUri}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        "Authorization": authorizationHeader,
      },
      body: arrayBuf,
    });

    if (res.ok) {
      console.log(`[R2 Direct Upload Success] ${r2Path}`);
      return true;
    } else {
      console.warn(`[R2 Direct Upload Failed ${res.status}]`, await res.text());
      return false;
    }
  } catch (err) {
    console.warn(`[R2 Direct Upload Error]:`, err);
    return false;
  }
}
