import { KEY_SIZE } from "./types";

export function padIso7816(input: Buffer, blockSize = KEY_SIZE): Buffer {
	// Python's Crypto.Util.Padding.pad(..., "iso7816")
	const padLen = blockSize - (input.length % blockSize);
	const out = Buffer.alloc(input.length + padLen);
	input.copy(out, 0);
	out[input.length] = 0x80;
	// the rest are 0x00 already
	return out;
}

export function unpadIso7816(padded: Buffer): Buffer {
	// Remove ISO 7816-4 padding: find last 0x80 and cut there, else throw
	let i = padded.length - 1;
	// strip trailing 0x00
	while (i >= 0 && padded[i] === 0x00) {
		i--;
	}
	if (i < 0 || padded[i] !== 0x80) {
		throw new Error("Invalid ISO7816 padding");
	}
	return padded.subarray(0, i);
}

/** calc FCC as in Python: 0x100 - (sum(payload[0:20]) % 0x100)  then mod 0x100 */
export function calcFcc(payload: Buffer): number {
	const slice = payload.subarray(0, 20);
	const sum = slice.reduce((s, b) => s + b, 0);
	return (0x100 - (sum % 0x100)) % 0x100;
}

export function getMacFromStateId(id: string): string | null {
	const parts = id.split(".");
	const idx = parts.indexOf("devices");

	if (idx >= 0 && parts.length > idx + 1) {
		return parts[idx + 1]; // das ist die MAC
	}

	return null;
}

export function isValidIPv4(ip: string): boolean {
	// Basic structural check (4 octets, only digits)
	const parts = ip.split(".");
	if (parts.length !== 4) {
		return false;
	}

	for (const part of parts) {
		// Reject empty, non-numeric or leading zeros like "01"
		if (!/^\d{1,3}$/.test(part)) {
			return false;
		}

		const num = Number(part);
		if (num < 0 || num > 255) {
			return false;
		}
	}

	return true;
}

export function enumToStates(enumObj: any): Record<string, string> {
	const res: Record<string, string> = {};
	for (const key of Object.keys(enumObj)) {
		const v = enumObj[key];
		if (typeof v === "number") {
			res[v] = enumName(enumObj, v) ?? key;
		}
	}
	return res;
}

export function isEnumValue(enumObj: any, value: number): boolean {
	return Object.values(enumObj).includes(value);
}

export function enumName(enumObj: any, value: number): string {
	return enumObj[value] ?? value.toString();
}
