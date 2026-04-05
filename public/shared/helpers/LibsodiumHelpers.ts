import sodium from "libsodium-wrappers-sumo";

const PRIVATE_KEY_STORAGE_KEY = "kakiokiPrivateKey";
const SHARED_KEY_STORAGE_KEY = "kakiokiSharedKeys";
export const PASSWORD_STORAGE_KEY = "kakiokiPassword";

let ready: Promise<typeof sodium> | null = null;

async function getSodiumClient() {
  if (!ready) {
    ready = sodium.ready.then(() => sodium);
  }
  return ready;
}

let cachedPrivateKey: Uint8Array | null = null;
const sharedKeyCache = new Map<string, Uint8Array>();
let cachedPublicKeyEncoded: string | null = null;
let cachedPublicKeyBytes: Uint8Array | null = null;

function loadSharedKeyStorage(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = sessionStorage.getItem(SHARED_KEY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persistSharedKeyStorage(storage: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(SHARED_KEY_STORAGE_KEY, JSON.stringify(storage));
}

async function decodeEncryptedKey(encoded: string) {
  const sodium = await getSodiumClient();
  const [version, rest] = encoded.split(":");
  if (!version || !rest) {
    throw new Error("Invalid encrypted key payload");
  }
  const parts = rest.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key payload");
  }
  const salt = sodium.from_base64(
    parts[0],
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const nonce = sodium.from_base64(
    parts[1],
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const ciphertext = sodium.from_base64(
    parts[2],
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  return { salt, nonce, ciphertext };
}

export async function decryptPrivateKeyWithPassword(
  secretKeyEncrypted: string,
  password: string,
): Promise<Uint8Array> {
  const sodium = await getSodiumClient();
  const { salt, nonce, ciphertext } =
    await decodeEncryptedKey(secretKeyEncrypted);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  );
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!decrypted) {
    throw new Error("Unable to decrypt private key");
  }
  return decrypted;
}

export async function storePrivateKey(privateKey: Uint8Array) {
  const sodium = await getSodiumClient();
  cachedPrivateKey = new Uint8Array(privateKey);
  cachedPublicKeyEncoded = null;
  cachedPublicKeyBytes = null;
  if (typeof window !== "undefined") {
    const encoded = sodium.to_base64(
      privateKey,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    );
    sessionStorage.setItem(PRIVATE_KEY_STORAGE_KEY, encoded);
  }
}

export function clearStoredPrivateKey() {
  cachedPrivateKey = null;
  cachedPublicKeyEncoded = null;
  cachedPublicKeyBytes = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    sessionStorage.removeItem(SHARED_KEY_STORAGE_KEY);
    sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
  }
  sharedKeyCache.clear();
}

export async function getStoredPrivateKey(): Promise<Uint8Array | null> {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const encoded = sessionStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  if (!encoded) {
    return null;
  }
  try {
    const sodium = await getSodiumClient();
    const decoded = sodium.from_base64(
      encoded,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    );
    cachedPrivateKey = decoded;
    return decoded;
  } catch (error) {
    console.error("Failed to restore cached private key from storage:", error);
    sessionStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    return null;
  }
  return null;
}

export async function ensurePrivateKey(
  password: string,
  secretKeyEncrypted: string,
): Promise<Uint8Array> {
  const existing = await getStoredPrivateKey();
  if (existing) {
    return existing;
  }
  const decrypted = await decryptPrivateKeyWithPassword(
    secretKeyEncrypted,
    password,
  );
  await storePrivateKey(decrypted);
  return decrypted;
}

export async function cachePublicKey(publicKey: string) {
  const sodium = await getSodiumClient();
  cachedPublicKeyEncoded = publicKey;
  cachedPublicKeyBytes = sodium.from_base64(
    publicKey,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
}

export function getStoredPassword(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return sessionStorage.getItem(PASSWORD_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function ensurePrivateKeyFromSession(
  secretKeyEncrypted?: string | null,
): Promise<boolean> {
  if (!secretKeyEncrypted) {
    return false;
  }
  const stored = await getStoredPrivateKey();
  if (stored) {
    return true;
  }
  const password = getStoredPassword();
  if (!password) {
    console.debug("No stored session password; cannot restore private key");
    return false;
  }
  try {
    await ensurePrivateKey(password, secretKeyEncrypted);
    return true;
  } catch (error) {
    console.error("Failed to restore private key from session:", error);
    return false;
  }
}

export async function ensurePrivateKeyAvailable(
  secretKeyEncrypted?: string | null,
): Promise<Uint8Array> {
  let privateKey = await getStoredPrivateKey();
  if (privateKey) {
    return privateKey;
  }
  if (secretKeyEncrypted) {
    console.debug("Attempting to restore private key from encrypted payload");
    const restored = await ensurePrivateKeyFromSession(secretKeyEncrypted);
    if (restored) {
      privateKey = await getStoredPrivateKey();
      if (privateKey) {
        return privateKey;
      }
    }
  }
  console.debug("Decrypted private key available:", false);
  throw new Error("Private key unavailable");
}

function createSharedKeyCacheKey(
  selfId: number,
  friendId: number,
  selfPublicKey: string,
  friendPublicKey: string,
) {
  return `${selfId}:${friendId}:${selfPublicKey}:${friendPublicKey}`;
}

function resolveSelfPublicKey(
  sodium: Awaited<ReturnType<typeof getSodiumClient>>,
  privateKey: Uint8Array,
  provided?: string,
) {
  if (provided) {
    if (cachedPublicKeyEncoded === provided && cachedPublicKeyBytes) {
      return { encoded: cachedPublicKeyEncoded, bytes: cachedPublicKeyBytes };
    }
    try {
      const decoded = sodium.from_base64(
        provided,
        sodium.base64_variants.URLSAFE_NO_PADDING,
      );
      cachedPublicKeyEncoded = provided;
      cachedPublicKeyBytes = decoded;
      return { encoded: provided, bytes: decoded };
    } catch {
      cachedPublicKeyEncoded = null;
      cachedPublicKeyBytes = null;
    }
  }
  if (cachedPublicKeyEncoded && cachedPublicKeyBytes) {
    return { encoded: cachedPublicKeyEncoded, bytes: cachedPublicKeyBytes };
  }
  const derived = sodium.crypto_scalarmult_base(privateKey);
  const encoded = sodium.to_base64(
    derived,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  cachedPublicKeyEncoded = encoded;
  cachedPublicKeyBytes = derived;
  return { encoded, bytes: derived };
}

function readStoredSharedKey(
  cacheKey: string,
  sodium: Awaited<ReturnType<typeof getSodiumClient>>,
) {
  if (typeof window === "undefined") {
    return null;
  }
  const storage = loadSharedKeyStorage();
  const encoded = storage[cacheKey];
  if (!encoded) {
    return null;
  }
  try {
    return sodium.from_base64(
      encoded,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    );
  } catch {
    delete storage[cacheKey];
    persistSharedKeyStorage(storage);
    return null;
  }
}

function persistSharedKey(
  cacheKey: string,
  shared: Uint8Array,
  sodium: Awaited<ReturnType<typeof getSodiumClient>>,
) {
  if (typeof window === "undefined") {
    return;
  }
  const storage = loadSharedKeyStorage();
  storage[cacheKey] = sodium.to_base64(
    shared,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  persistSharedKeyStorage(storage);
}

export async function deriveSharedKey(
  selfId: number,
  friendId: number,
  friendPublicKey: string,
  selfPublicKey?: string,
): Promise<Uint8Array> {
  const privateKey = await getStoredPrivateKey();
  if (!privateKey) {
    throw new Error("Private key not available");
  }
  const sodium = await getSodiumClient();
  const { encoded: resolvedSelfPublicKey, bytes: selfPublicKeyBytes } =
    resolveSelfPublicKey(sodium, privateKey, selfPublicKey);
  const cacheKey = createSharedKeyCacheKey(
    selfId,
    friendId,
    resolvedSelfPublicKey,
    friendPublicKey,
  );
  const cached = sharedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const stored = readStoredSharedKey(cacheKey, sodium);
  if (stored) {
    sharedKeyCache.set(cacheKey, stored);
    return stored;
  }
  const peerKey = sodium.from_base64(
    friendPublicKey,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const isClient = selfId < friendId;
  const { sharedRx, sharedTx } = isClient
    ? sodium.crypto_kx_client_session_keys(
        selfPublicKeyBytes,
        privateKey,
        peerKey,
      )
    : sodium.crypto_kx_server_session_keys(
        selfPublicKeyBytes,
        privateKey,
        peerKey,
      );
  const firstSegment = isClient ? sharedTx : sharedRx;
  const secondSegment = isClient ? sharedRx : sharedTx;
  const combined = new Uint8Array(firstSegment.length + secondSegment.length);
  combined.set(firstSegment);
  combined.set(secondSegment, firstSegment.length);
  const shared = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    combined,
    null,
  );
  sharedKeyCache.set(cacheKey, shared);
  persistSharedKey(cacheKey, shared, sodium);
  return shared;
}

export async function encryptTextWithSharedKey(
  sharedKey: Uint8Array,
  message: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const sodium = await getSodiumClient();
  const encoder = new TextEncoder();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(
    encoder.encode(message),
    nonce,
    sharedKey,
  );
  return {
    ciphertext: sodium.to_base64(
      ciphertext,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    ),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING),
  };
}

export async function decryptTextWithSharedKey(
  sharedKey: Uint8Array,
  ciphertext: string,
  nonce: string,
): Promise<string> {
  const sodium = await getSodiumClient();
  const decoder = new TextDecoder();
  const cipherBytes = sodium.from_base64(
    ciphertext,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const nonceBytes = sodium.from_base64(
    nonce,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const decrypted = sodium.crypto_secretbox_open_easy(
    cipherBytes,
    nonceBytes,
    sharedKey,
  );
  if (!decrypted) {
    throw new Error("Unable to decrypt message");
  }
  return decoder.decode(decrypted);
}
