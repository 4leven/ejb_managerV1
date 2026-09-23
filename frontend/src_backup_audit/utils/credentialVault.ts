const DB_NAME = "ejb-manager-secure-login";
const STORE = "vault";

const openVault = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const read = async <T>(key: string) => {
  const db = await openVault();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
};
const write = async (key: string, value: unknown) => {
  const db = await openVault();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
export async function saveRememberedCredentials(
  email: string,
  password: string,
) {
  if (!window.crypto?.subtle || !window.indexedDB) return false;
  let key = await read<CryptoKey>("device-key");
  if (!key) {
    key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await write("device-key", key);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify({ email, password }));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain,
  );
  await write("credentials", {
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher)),
  });
  return true;
}
export async function loadRememberedCredentials() {
  if (!window.crypto?.subtle || !window.indexedDB) return null;
  try {
    const key = await read<CryptoKey>("device-key"),
      stored = await read<{ iv: number[]; cipher: number[] }>("credentials");
    if (!key || !stored) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(stored.iv) },
      key,
      new Uint8Array(stored.cipher),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as {
      email: string;
      password: string;
    };
  } catch {
    await clearRememberedCredentials();
    return null;
  }
}
export async function clearRememberedCredentials() {
  if (!window.indexedDB) return;
  const db = await openVault();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .delete("credentials");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
