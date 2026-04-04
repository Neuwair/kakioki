import sodium from "libsodium-wrappers-sumo";

const PREFIX = "v1";
let ready: Promise<typeof sodium> | null = null;

export type EncryptedKeyPayload = {
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  version: string;
};

export async function getSodium() {
  if (!ready) {
    ready = sodium.ready.then(() => sodium);
  }
  return ready;
}

export async function generateKeyPair() {
  const sodium = await getSodium();
  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

export async function encryptPrivateKey(
  privateKey: Uint8Array,
  password: string,
) {
  const sodium = await getSodium();
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  );
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(privateKey, nonce, key);
  return encodeEncryptedKey(
    { salt, nonce, ciphertext, version: PREFIX },
    sodium,
  );
}

export async function decryptPrivateKey(encoded: string, password: string) {
  const sodium = await getSodium();
  const payload = decodeEncryptedKey(encoded, sodium);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    payload.salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  );
  const decrypted = sodium.crypto_secretbox_open_easy(
    payload.ciphertext,
    payload.nonce,
    key,
  );
  if (!decrypted) {
    throw new Error("Invalid private key payload");
  }
  return decrypted;
}

export function encodeEncryptedKey(
  payload: EncryptedKeyPayload,
  sodium: Awaited<ReturnType<typeof getSodium>>,
) {
  const salt = sodium.to_base64(
    payload.salt,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const nonce = sodium.to_base64(
    payload.nonce,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const ciphertext = sodium.to_base64(
    payload.ciphertext,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  return `${payload.version}:${salt}.${nonce}.${ciphertext}`;
}

export function decodeEncryptedKey(
  encoded: string,
  sodium: Awaited<ReturnType<typeof getSodium>>,
) {
  const [version, rest] = encoded.split(":");
  if (!version || !rest) {
    throw new Error("Malformed encrypted key payload");
  }
  const parts = rest.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted key payload");
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
  return { salt, nonce, ciphertext, version };
}
