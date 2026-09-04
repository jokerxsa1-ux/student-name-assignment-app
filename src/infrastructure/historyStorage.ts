import type { PersistedHistoryPayload } from '../domain/types';

const DB_NAME = 'student-name-assignment-secure-store';
const STORE_NAME = 'encrypted-data';
const RECORD_KEY = 'seat-history';
const DEFAULT_ITERATIONS = 310_000;

export interface EncryptedHistoryRecord {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
  updatedAt: string;
}

export async function encryptHistory(
  payload: PersistedHistoryPayload,
  passphrase: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<EncryptedHistoryRecord> {
  if (passphrase.length < 10) throw new Error('パスフレーズは10文字以上にしてください。');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    version: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iterations,
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptHistory(
  record: EncryptedHistoryRecord,
  passphrase: string,
): Promise<PersistedHistoryPayload> {
  try {
    if (
      record.version !== 1 ||
      !Number.isInteger(record.iterations) ||
      record.iterations < 1_000 ||
      record.iterations > 1_000_000 ||
      record.ciphertext.length > 2_000_000
    ) throw new Error('保存形式が正しくありません。');
    const salt = fromBase64(record.salt);
    const iv = fromBase64(record.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('保存形式が正しくありません。');
    const key = await deriveKey(passphrase, salt, record.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fromBase64(record.ciphertext) as BufferSource,
    );
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as PersistedHistoryPayload;
    if (!isHistoryPayload(payload)) throw new Error('形式が正しくありません。');
    return payload;
  } catch {
    throw new Error('パスフレーズが違うか、保存データが破損しています。');
  }
}

function isHistoryPayload(payload: PersistedHistoryPayload): boolean {
  return payload.version === 1 &&
    typeof payload.savedAt === 'string' &&
    Array.isArray(payload.roster) &&
    payload.roster.length <= 100 &&
    payload.roster.every((student) =>
      typeof student?.id === 'string' &&
      typeof student?.name === 'string' &&
      student.name.length <= 200 &&
      typeof student?.excluded === 'boolean') &&
    Array.isArray(payload.seatHistory) &&
    payload.seatHistory.length <= 2 &&
    payload.seatHistory.every((entry) =>
      typeof entry?.id === 'string' &&
      typeof entry?.createdAt === 'string' &&
      entry?.placementByStudent != null &&
      typeof entry.placementByStudent === 'object');
}

export async function saveEncryptedHistory(record: EncryptedHistoryRecord): Promise<void> {
  const db = await openDatabase();
  await transactionPromise(db, 'readwrite', (store) => store.put(record, RECORD_KEY));
  db.close();
}

export async function loadEncryptedHistory(): Promise<EncryptedHistoryRecord | undefined> {
  const db = await openDatabase();
  const result = await transactionPromise<EncryptedHistoryRecord | undefined>(db, 'readonly', (store) => store.get(RECORD_KEY));
  db.close();
  return result;
}

export async function deleteEncryptedHistory(): Promise<void> {
  const db = await openDatabase();
  await transactionPromise(db, 'readwrite', (store) => store.delete(RECORD_KEY));
  db.close();
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionPromise<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
