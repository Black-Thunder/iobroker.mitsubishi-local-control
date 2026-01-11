// src/mitsubishi/mitsubishiApi.ts
import type { AxiosInstance } from "axios";
import axios from "axios";
import * as crypto from "node:crypto";
import { KEY_SIZE, STATIC_KEY } from "./types";
import { padIso7816, unpadIso7816 } from "./utils";

export class MitsubishiAPI {
	private adapter: ioBroker.Adapter;
	private deviceHostPort: string;
	private encryptionKey: Buffer;
	private http: AxiosInstance;

	constructor(deviceHostPort: string, adapter: ioBroker.Adapter, encryptionKey: string | Buffer = STATIC_KEY) {
		this.deviceHostPort = deviceHostPort;
		this.adapter = adapter;
		if (typeof encryptionKey === "string") {
			encryptionKey = Buffer.from(encryptionKey, "utf8");
		}
		if (encryptionKey.length < KEY_SIZE) {
			encryptionKey = Buffer.concat([encryptionKey, Buffer.alloc(KEY_SIZE - encryptionKey.length, 0x00)]);
		}
		this.encryptionKey = encryptionKey.subarray(0, KEY_SIZE);

		this.http = axios.create({
			timeout: 2000,
			headers: {
				"User-Agent":
					"KirigamineRemote/5.1.0 (jp.co.MitsubishiElectric.KirigamineRemote; build:3; iOS 17.5.1) Alamofire/5.9.1",
			},
			// do not automatically throw for non-2xx; we will call resp.status/raise manually
			validateStatus: () => true,
		});
	}

	getCryptoKey(): Buffer {
		return this.encryptionKey;
	}

	getDeviceHostPort(): string {
		return this.deviceHostPort;
	}

	/**
	 * Encrypt payload using AES-CBC with ISO7816-4 padding
	 * Returns base64(iv + ciphertext)
	 */
	encryptPayload(payload: string, iv?: Buffer): string {
		if (!iv) {
			iv = crypto.randomBytes(KEY_SIZE);
		}
		const cipher = crypto.createCipheriv("aes-128-cbc", this.encryptionKey, iv);
		cipher.setAutoPadding(false);

		const payloadBytes = Buffer.from(payload, "utf8");
		const padded = padIso7816(payloadBytes, KEY_SIZE);

		const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

		const combined = Buffer.concat([iv, encrypted]);
		return combined.toString("base64");
	}

	/**
	 * Decrypt base64(iv + ciphertext) using AES-CBC + ISO7816 unpad fallback.
	 * Try iso7816 unpad; on failure strip trailing \x00;
	 * then try to decode UTF-8; on UnicodeDecodeError search for closing tags and fallback to ignore errors.
	 */
	decryptPayload(payload_b64: string): string {
		// base64 -> bytes
		const encrypted = Buffer.from(payload_b64, "base64"); // may throw

		// Extract IV and encrypted_data
		const iv = encrypted.subarray(0, KEY_SIZE);
		const encrypted_data = encrypted.subarray(KEY_SIZE);

		// AES-CBC decrypt
		const decipher = crypto.createDecipheriv("aes-128-cbc", this.encryptionKey, iv);
		decipher.setAutoPadding(false);
		let decrypted: Buffer;
		try {
			decrypted = Buffer.concat([decipher.update(encrypted_data), decipher.final()]);
		} catch (e) {
			// Propagate error (will be caught higher-level)
			throw new Error(`Decryption failed: ${(e as Error).message}`);
		}

		// Try ISO7816 unpad
		let decrypted_clean: Buffer;
		try {
			decrypted_clean = unpadIso7816(decrypted);
		} catch {
			// fallback: remove trailing 0x00
			let end = decrypted.length;
			while (end > 0 && decrypted[end - 1] === 0x00) {
				end--;
			}
			decrypted_clean = decrypted.subarray(0, end);
		}

		// Try to decode as UTF-8
		try {
			const result = decrypted_clean.toString("utf8");
			return result;
		} catch {
			// Node's Buffer.toString won't throw UnicodeDecodeError; but we'll follow fallback logic.
			// Attempt to find closing tags in raw bytes, then decode slice.
		}

		// Try to find closing XML tags
		const xml_end_patterns = [Buffer.from("</LSV>"), Buffer.from("</CSV>"), Buffer.from("</ESV>")];
		for (const pattern of xml_end_patterns) {
			const pos = decrypted_clean.indexOf(pattern);
			if (pos !== -1) {
				const end_pos = pos + pattern.length;
				const truncated = decrypted_clean.subarray(0, end_pos);
				try {
					return truncated.toString("utf8");
				} catch {
					// continue
				}
			}
		}

		// Last resort: decode ignoring errors (in Node Buffer.toString does not have errors='ignore' param,
		// but replacing invalid sequences is default behaviour; to mimic 'ignore' we can remove replacement characters)
		// We'll return decoded string (replacement characters may appear).
		const fallback_result = decrypted_clean.toString("utf8");
		return fallback_result;
	}

	/**
	 * Make HTTP request to /smart endpoint.
	 * Encrypt payload, wrap in <ESV>..</ESV>, POST, parse response, decrypt.
	 */
	async makeRequest(payload_xml: string): Promise<string> {
		// Encrypt
		const encrypted_payload = this.encryptPayload(payload_xml);

		// Build request body (exact same string shape)
		const request_body = `<?xml version="1.0" encoding="UTF-8"?><ESV>${encrypted_payload}</ESV>`;

		const headers = {
			Host: `${this.deviceHostPort}`,
			"Content-Type": "text/plain;chrset=UTF-8",
			Connection: "keep-alive",
			"Proxy-Connection": "keep-alive",
			Accept: "*/*",
			"User-Agent":
				"KirigamineRemote/5.1.0 (jp.co.MitsubishiElectric.KirigamineRemote; build:3; iOS 17.5.1) Alamofire/5.9.1",
			"Accept-Language": "zh-Hant-JP;q=1.0, ja-JP;q=0.9",
		};

		const url = `http://${this.deviceHostPort}/smart`;

		// retry logic: total=4, backoff_factor=1 (attempts 0..4)
		const maxRetries = 4;
		let lastErr: any = null;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const resp = await this.http.post(url, request_body, { headers, timeout: 2000 });
				this.raiseForStatus(resp);

				// Parse XML root and get root.text like ElementTree.fromstring(...).text
				// Here extract inner text between the outermost tag, e.g. <ESV>...</ESV>
				const m = String(resp.data).match(/<ESV>\s*([^<]+)\s*<\/ESV>/i);
				const encrypted_response = m?.[1];

				if (encrypted_response) {
					if (encrypted_response.length % 4 !== 0) {
						this.adapter.log.error(`Invalid base64 length: ${encrypted_response.length}`);
					}

					const decrypted = this.decryptPayload(encrypted_response);
					return decrypted;
				}
				throw new Error("Could not find any text in response");
			} catch (err) {
				lastErr = err;
				if (attempt < maxRetries) {
					const wait = attempt === 0 ? 0 : 1000 * Math.pow(2, attempt - 1); // backoff_factor=1 -> 0s,1s,2s,4s...
					await new Promise(r => this.adapter.setTimeout(r, wait, undefined));
					continue;
				}
				throw lastErr;
			}
		}
		throw lastErr;
	}

	private raiseForStatus(resp: axios.AxiosResponse): void {
		if (resp.status >= 400 && resp.status < 600) {
			const err = new Error(`${resp.status} ${resp.status >= 500 ? "Server" : "Client"} Error`) as Error & {
				status?: number;
				body?: unknown;
			};

			err.status = resp.status;
			err.body = resp.data;

			throw err;
		}
	}

	sendRebootRequest(): Promise<string> {
		return this.makeRequest("<CSV><RESET></RESET></CSV>");
	}

	sendStatusRequest(): Promise<string> {
		return this.makeRequest("<CSV><CONNECT>ON</CONNECT></CSV>");
	}

	sendEchonetEnable(): Promise<string> {
		return this.makeRequest("<CSV><CONNECT>ON</CONNECT><ECHONET>ON</ECHONET></CSV>");
	}

	sendCommand(command: Buffer | Uint8Array): Promise<string> {
		const hex = Buffer.isBuffer(command) ? command.toString("hex") : Buffer.from(command).toString("hex");
		return this.sendHexCommand(hex);
	}

	sendHexCommand(hexCommand: string): Promise<string> {
		const payload = `<CSV><CONNECT>ON</CONNECT><CODE><VALUE>${hexCommand}</VALUE></CODE></CSV>`;
		return this.makeRequest(payload);
	}

	close(): void {
		// nothing to close; keep for API parity
		(this.http as any) = null;
	}
}
