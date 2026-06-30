import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AccountRecord = {
  id: string;
  platform: string;
  account: string;
  password: string;
  email: string;
  phone: string;
  note: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type VaultPayload = {
  records: AccountRecord[];
};

type EncryptedVaultFile = {
  version: 1;
  passwordSalt: string;
  passwordHash: string;
  encryptionSalt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;
};

const PASSWORD_HASH_ITERATIONS = 160_000;
const ENCRYPTION_KEY_ITERATIONS = 220_000;

function cleanString(value: unknown, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function createId() {
  return crypto.randomUUID();
}

function toBase64(buffer: Buffer) {
  return buffer.toString('base64');
}

function fromBase64(value: string) {
  return Buffer.from(value, 'base64');
}

function derivePasswordHash(password: string, salt: Buffer) {
  return crypto.pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 32, 'sha256');
}

function deriveEncryptionKey(password: string, salt: Buffer) {
  return crypto.pbkdf2Sync(password, salt, ENCRYPTION_KEY_ITERATIONS, 32, 'sha256');
}

function timingSafeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normalizeRecord(value: Partial<AccountRecord> | null | undefined, fallbackId = createId()): AccountRecord {
  const now = new Date().toISOString();
  const createdAt = cleanString(value?.createdAt) || now;
  return {
    id: cleanString(value?.id) || fallbackId,
    platform: cleanString(value?.platform, 120),
    account: cleanString(value?.account, 240),
    password: cleanString(value?.password, 1000),
    email: cleanString(value?.email, 240),
    phone: cleanString(value?.phone, 80),
    note: cleanString(value?.note, 2000),
    url: cleanString(value?.url, 500),
    createdAt,
    updatedAt: cleanString(value?.updatedAt) || createdAt,
  };
}

export class PasswordVaultStore {
  private readonly storePath: string;

  private unlockedPayload: VaultPayload | null = null;

  private encryptionKey: Buffer | null = null;

  private activePassword: string | null = null;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'password-vault-store.json');
  }

  getStatus() {
    return {
      configured: fs.existsSync(this.storePath),
      unlocked: Boolean(this.unlockedPayload && this.encryptionKey),
    };
  }

  setup(password: string) {
    const normalizedPassword = this.normalizePassword(password);
    if (fs.existsSync(this.storePath)) {
      throw new Error('Vault already configured');
    }

    const passwordSalt = crypto.randomBytes(16);
    const encryptionSalt = crypto.randomBytes(16);
    this.activePassword = normalizedPassword;
    this.encryptionKey = deriveEncryptionKey(normalizedPassword, encryptionSalt);
    this.unlockedPayload = { records: [] };
    this.writeEncrypted({
      passwordSalt,
      passwordHash: derivePasswordHash(normalizedPassword, passwordSalt),
      encryptionSalt,
      payload: this.unlockedPayload,
    });

    return this.getStatus();
  }

  unlock(password: string) {
    const normalizedPassword = this.normalizePassword(password);
    const file = this.readEncryptedFile();
    if (!file) {
      throw new Error('Vault not configured');
    }

    const passwordSalt = fromBase64(file.passwordSalt);
    const expectedHash = fromBase64(file.passwordHash);
    const actualHash = derivePasswordHash(normalizedPassword, passwordSalt);
    if (!timingSafeEqual(actualHash, expectedHash)) {
      throw new Error('Invalid password');
    }

    const encryptionSalt = fromBase64(file.encryptionSalt);
    const key = deriveEncryptionKey(normalizedPassword, encryptionSalt);
    this.unlockedPayload = this.decryptPayload(file, key);
    this.encryptionKey = key;
    this.activePassword = normalizedPassword;
    return this.listRecords();
  }

  lock() {
    this.unlockedPayload = null;
    this.encryptionKey = null;
    this.activePassword = null;
    return this.getStatus();
  }

  reset() {
    this.lock();
    fs.rmSync(this.storePath, { force: true });
    return this.getStatus();
  }

  listRecords() {
    return this.getUnlockedPayload().records;
  }

  addRecord(record: Partial<AccountRecord>) {
    const payload = this.getUnlockedPayload();
    const now = new Date().toISOString();
    const nextRecord = normalizeRecord({
      ...record,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    });
    payload.records = [nextRecord, ...payload.records];
    this.saveUnlockedPayload();
    return payload.records;
  }

  updateRecord(id: string, record: Partial<AccountRecord>) {
    const payload = this.getUnlockedPayload();
    const normalizedId = cleanString(id);
    payload.records = payload.records.map((item) => {
      if (item.id !== normalizedId) return item;
      return normalizeRecord({
        ...item,
        ...record,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });
    });
    this.saveUnlockedPayload();
    return payload.records;
  }

  deleteRecord(id: string) {
    const payload = this.getUnlockedPayload();
    const normalizedId = cleanString(id);
    payload.records = payload.records.filter((item) => item.id !== normalizedId);
    this.saveUnlockedPayload();
    return payload.records;
  }

  private normalizePassword(password: unknown) {
    const normalizedPassword = typeof password === 'string' ? password : '';
    if (normalizedPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    return normalizedPassword;
  }

  private getUnlockedPayload() {
    if (!this.unlockedPayload || !this.encryptionKey) {
      throw new Error('Vault locked');
    }
    return this.unlockedPayload;
  }

  private readEncryptedFile(): EncryptedVaultFile | null {
    if (!fs.existsSync(this.storePath)) return null;
    return JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as EncryptedVaultFile;
  }

  private decryptPayload(file: EncryptedVaultFile, key: Buffer): VaultPayload {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromBase64(file.iv));
    decipher.setAuthTag(fromBase64(file.authTag));
    const plaintext = Buffer.concat([decipher.update(fromBase64(file.ciphertext)), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as Partial<VaultPayload>;
    return {
      records: Array.isArray(parsed.records) ? parsed.records.map((item) => normalizeRecord(item)).filter((item) => item.platform || item.account) : [],
    };
  }

  private saveUnlockedPayload() {
    const file = this.readEncryptedFile();
    if (!file || !this.activePassword) {
      throw new Error('Vault not configured');
    }

    this.writeEncrypted({
      passwordSalt: fromBase64(file.passwordSalt),
      passwordHash: fromBase64(file.passwordHash),
      encryptionSalt: fromBase64(file.encryptionSalt),
      payload: this.getUnlockedPayload(),
    });
  }

  private writeEncrypted({
    passwordSalt,
    passwordHash,
    encryptionSalt,
    payload,
  }: {
    passwordSalt: Buffer;
    passwordHash: Buffer;
    encryptionSalt: Buffer;
    payload: VaultPayload;
  }) {
    if (!this.activePassword) {
      throw new Error('Vault locked');
    }

    const key = deriveEncryptionKey(this.activePassword, encryptionSalt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedFile: EncryptedVaultFile = {
      version: 1,
      passwordSalt: toBase64(passwordSalt),
      passwordHash: toBase64(passwordHash),
      encryptionSalt: toBase64(encryptionSalt),
      iv: toBase64(iv),
      authTag: toBase64(authTag),
      ciphertext: toBase64(ciphertext),
      updatedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(encryptedFile, null, 2)}\n`, 'utf8');
    this.encryptionKey = key;
    this.unlockedPayload = payload;
  }
}
