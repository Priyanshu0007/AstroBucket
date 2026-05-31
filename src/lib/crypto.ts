/**
 * crypto.ts
 * 
 * Cryptographic helper module using native Web Crypto API.
 * Encrypts and decrypts OAuth access tokens using AES-GCM-256.
 * The encryption key is derived via PBKDF2 using a user PIN combined with a stable browser fingerprint.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Generate a stable browser fingerprint to act as a device-specific salt/pepper.
 * This ensures that even if local storage is compromised, the token cannot be
 * decrypted on a different machine or browser without reproducing the exact fingerprint.
 */
function getBrowserFingerprint(): string {
  const parts = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language,
    navigator.hardwareConcurrency || 'unknown',
    new Date().getTimezoneOffset().toString()
  ];
  return parts.join('###');
}

/**
 * Convert ArrayBuffer to Base64 string.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM CryptoKey from a combination of PIN and browser fingerprint.
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const fingerprint = getBrowserFingerprint();
  const password = `${pin}::${fingerprint}`;
  
  // Import the password as a raw key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the 256-bit AES-GCM key using PBKDF2
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedSessionPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Encrypt a plain-text access token using a user PIN.
 * Returns a JSON string containing the ciphertext, IV, and salt in Base64.
 */
export async function encryptToken(token: string, pin: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(pin, salt);
  const tokenBytes = ENCODER.encode(token);
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    tokenBytes
  );
  
  const payload: EncryptedSessionPayload = {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
    salt: bufferToBase64(salt.buffer as ArrayBuffer)
  };
  
  return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted token payload string using the user PIN.
 * Throws an error if the PIN is incorrect or decryption fails (AES-GCM auth tag mismatch).
 */
export async function decryptToken(encryptedStr: string, pin: string): Promise<string> {
  const payload: EncryptedSessionPayload = JSON.parse(encryptedStr);
  
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);
  
  const key = await deriveKey(pin, salt);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    ciphertext as any
  );
  
  return DECODER.decode(decryptedBuffer);
}
