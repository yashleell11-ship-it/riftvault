/**
 * Decrypt Trust Wallet browser extension private-key export (encoded.txt).
 * Password is prompted on stdin — never logged or written to disk.
 *
 * Algorithm (Trust Wallet):
 *   Base64 decode → IV (16 bytes) + ciphertext → AES-256-CBC key = SHA-256(password)
 */
import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { privateKeyToAccount } from "viem/accounts";

const ENCODED_FILE = join(process.cwd(), "encoded.txt");

function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = input;
    const wasRaw = stdin.isRaw;

    if (!stdin.isTTY) {
      reject(new Error("Password prompt requires an interactive terminal (TTY)"));
      return;
    }

    output.write(prompt);

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";

    const cleanup = () => {
      stdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (char: string) => {
      switch (char) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          cleanup();
          output.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          cleanup();
          output.write("\n");
          process.exit(130);
          break;
        case "\u007f": // Backspace (Unix)
        case "\b":
        case "\u0016": // Ctrl+Backspace (some terminals)
          password = password.slice(0, -1);
          break;
        default:
          if (char >= " " || char > "\u007f") {
            password += char;
          }
          break;
      }
    };

    stdin.on("data", onData);
  });
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function main() {
  let encodedRaw: string;
  try {
    encodedRaw = readFileSync(ENCODED_FILE, "utf8").trim();
  } catch {
    fail(`Could not read ${ENCODED_FILE}`);
  }

  if (!encodedRaw) {
    fail("encoded.txt is empty");
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(encodedRaw, "base64");
  } catch {
    fail("encoded.txt is not valid Base64");
  }

  if (decoded.length < 17) {
    fail("encoded.txt is too short after Base64 decode (need IV + ciphertext)");
  }

  const iv = decoded.subarray(0, 16);
  const ciphertext = decoded.subarray(16);

  const password = await promptPassword("Trust Wallet export password: ");

  const aesKey = createHash("sha256").update(password, "utf8").digest();

  let plaintext: string;
  try {
    const decipher = createDecipheriv("aes-256-cbc", aesKey, iv);
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    fail("Decryption failed — incorrect password or corrupted export file");
  }

  const trimmed = plaintext.trim();
  const hexBody = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;

  if (!/^[a-fA-F0-9]{64}$/.test(hexBody)) {
    fail("Decrypted value is not a valid 64-character hex private key");
  }

  const privateKey = `0x${hexBody}` as `0x${string}`;
  let address: string;
  try {
    address = privateKeyToAccount(privateKey).address;
  } catch {
    fail("Private key failed viem validation");
  }

  console.log("Private key:");
  console.log(hexBody);
  console.log("");
  console.log("Address:");
  console.log(address);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
