import { isValidIPv4 } from "./utils";

export function validateConfig(adapter: any): boolean {
	adapter.log.debug("Checking adapter settings...");

	// --- Validate polling interval ---
	if (!adapter.config.pollingInterval || adapter.config.pollingInterval < 15) {
		adapter.config.pollingInterval = 15;
		adapter.log.warn("Polling interval can't be set lower than 15 seconds. Now set to 15 seconds.");
	}

	// --- Validate devices array existence ---
	const devices = adapter.config.devices;
	if (!devices || !Array.isArray(devices)) {
		adapter.log.error("No valid devices configured. Please add at least one device.");
		return false;
	}

	// --- Filter invalid devices ---
	const cleanedDevices = devices.filter(d => d?.name?.trim() && d?.ip?.trim() && isValidIPv4(d.ip.trim()));

	if (cleanedDevices.length !== devices.length) {
		adapter.log.warn("Some device entries were invalid and have been removed.");
	}

	// Update config
	adapter.config.devices = cleanedDevices;

	// --- Check if at least one valid device remains ---
	if (adapter.config.devices.length === 0) {
		adapter.log.error("No valid devices configured. Please add at least one device.");
		return false;
	}

	return true;
}
