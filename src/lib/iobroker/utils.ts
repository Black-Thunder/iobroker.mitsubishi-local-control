import { Device } from "../mitsubishi/device";

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

export function getDeviceByMac(adapter: any, mac: string): Device | undefined {
	const noColMac = String(mac)
		.toLowerCase()
		.replace(/[^0-9a-f]/g, "");
	if (noColMac.length !== 12) {
		return undefined;
	}

	const colMac = noColMac.match(/.{1,2}/g)!.join(":");

	return adapter.devices.find((c: Device) => c.controller.parsedDeviceState?.mac === colMac);
}

export async function setAdapterConnectionState(adapter: any, isConnected: boolean): Promise<void> {
	await adapter.setStateChangedAsync("info.connection", isConnected, true);
	adapter.setForeignState(`system.adapter.${adapter.namespace}.connected`, isConnected, true);
}
