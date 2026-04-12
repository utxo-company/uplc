import { toast } from "svelte-sonner";

export function notifyError(title: string, detail?: string): void {
  toast.error(title, detail ? { description: detail } : undefined);
}

export function notifySuccess(title: string, detail?: string): void {
  toast.success(title, detail ? { description: detail } : undefined);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const trimmed = hex.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (trimmed.length === 0) {
    throw new Error("Hex input is empty");
  }
  if (trimmed.length % 2 !== 0) {
    throw new Error("Hex input has an odd number of characters");
  }
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    throw new Error("Hex input contains non-hex characters");
  }
  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Read a CBOR bytestring header and return the payload slice. Throws if the
// input does not begin with a CBOR bytestring.
function readCborByteString(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) {
    throw new Error("CBOR input is empty");
  }
  const head = bytes[0]!;
  const major = head >> 5;
  const info = head & 0x1f;
  if (major !== 2) {
    throw new Error(
      `Expected CBOR bytestring (major type 2), got major type ${major}`,
    );
  }

  let length: number;
  let offset: number;
  if (info < 24) {
    length = info;
    offset = 1;
  } else if (info === 24) {
    if (bytes.length < 2) throw new Error("Truncated CBOR bytestring header");
    length = bytes[1]!;
    offset = 2;
  } else if (info === 25) {
    if (bytes.length < 3) throw new Error("Truncated CBOR bytestring header");
    length = (bytes[1]! << 8) | bytes[2]!;
    offset = 3;
  } else if (info === 26) {
    if (bytes.length < 5) throw new Error("Truncated CBOR bytestring header");
    length =
      bytes[1]! * 0x1000000 +
      ((bytes[2]! << 16) | (bytes[3]! << 8) | bytes[4]!);
    offset = 5;
  } else if (info === 27) {
    if (bytes.length < 9) throw new Error("Truncated CBOR bytestring header");
    let big = 0n;
    for (let i = 1; i <= 8; i++) big = (big << 8n) | BigInt(bytes[i]!);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("CBOR bytestring length exceeds safe integer range");
    }
    length = Number(big);
    offset = 9;
  } else if (info === 31) {
    throw new Error("Indefinite-length CBOR bytestrings are not supported");
  } else {
    throw new Error(`Invalid CBOR bytestring header (info=${info})`);
  }

  if (bytes.length < offset + length) {
    throw new Error("Truncated CBOR bytestring payload");
  }
  return bytes.slice(offset, offset + length);
}

// Unwrap a CBOR-wrapped script. Handles both single-wrap (bytestring of flat)
// and double-wrap (bytestring of bytestring of flat — cardano-cli style). The
// outer wrap is mandatory; the inner wrap is detected by a successful second
// decode.
export function unwrapCborScript(bytes: Uint8Array): Uint8Array {
  const inner = readCborByteString(bytes);
  try {
    const innerInner = readCborByteString(inner);
    // Only treat as double-wrap if the inner slice is fully consumed by the
    // second CBOR bytestring header + payload.
    const consumed = inner.length - innerInner.length;
    if (consumed > 0 && innerInner.length + consumed === inner.length) {
      return innerInner;
    }
  } catch {
    // Not a double-wrap — fall through.
  }
  return inner;
}

// Wrap raw flat bytes in a single CBOR bytestring header.
export function wrapCborScript(bytes: Uint8Array): Uint8Array {
  const len = bytes.length;
  let header: number[];
  if (len < 24) {
    header = [0x40 | len];
  } else if (len < 0x100) {
    header = [0x58, len];
  } else if (len < 0x10000) {
    header = [0x59, (len >> 8) & 0xff, len & 0xff];
  } else if (len < 0x100000000) {
    header = [
      0x5a,
      (len >>> 24) & 0xff,
      (len >>> 16) & 0xff,
      (len >>> 8) & 0xff,
      len & 0xff,
    ];
  } else {
    throw new Error("Payload exceeds CBOR uint32 length");
  }
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(bytes, header.length);
  return out;
}

// Open a hidden file input and resolve with the selected file's contents as
// bytes. Returns null if the user cancels the dialog.
export function pickFileAsBytes(
  accept: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("focus", onFocus);
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    const finish = (value: { name: string; bytes: Uint8Array } | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    // If the user cancels the dialog, no change event fires. The window regains
    // focus; give the change event a chance first, then treat it as cancel.
    const onFocus = () => {
      setTimeout(() => {
        if (!settled) finish(null);
      }, 300);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        finish({ name: file.name, bytes: new Uint8Array(buf) });
      } catch (err) {
        fail(err);
      }
    });

    window.addEventListener("focus", onFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

// Read selected file contents as trimmed UTF-8 text.
export async function pickFileAsText(
  accept: string,
): Promise<{ name: string; text: string } | null> {
  const picked = await pickFileAsBytes(accept);
  if (!picked) return null;
  const text = new TextDecoder("utf-8").decode(picked.bytes);
  return { name: picked.name, text };
}

// Trigger a classic <a download> save. The browser saves to the default
// downloads directory with the suggested name; no real location picker.
export function saveBytes(
  filename: string,
  bytes: Uint8Array,
  mime = "application/octet-stream",
): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveText(filename: string, text: string): void {
  saveBytes(filename, new TextEncoder().encode(text), "text/plain");
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
