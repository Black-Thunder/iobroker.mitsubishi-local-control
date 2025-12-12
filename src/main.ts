// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

import { getMacFromStateId } from "./lib/mitsubishi/utils";

import { MitsubishiController } from "./lib/mitsubishi/mitsubishiController";
import type { ParsedDeviceState } from "./lib/mitsubishi/types";
import {
	AutoMode,
	FanSpeed,
	OperationMode,
	RemoteLock,
	VaneHorizontalDirection,
	VaneVerticalDirection,
} from "./lib/mitsubishi/types";

interface Device {
	name: string;
	ip: string;
	mac: string | undefined;
	controller: MitsubishiController;
	pollingJob?: NodeJS.Timeout;
}

class MitsubishiLocalControl extends utils.Adapter {
	private devices: Device[] = [];

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "mitsubishi-local-control",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		await this.setAdapterConnectionState(false);

		if (!this.validateConfig()) {
			this.log.error("Invalid configuration detected. Stopping adapter.");
			return;
		}

		this.log.info(`Configuring ${this.config.devices.length} device(s)...`);

		this.devices = (this.config.devices ?? []).map(c => ({
			...c,
			controller: MitsubishiController.create(c.ip, this.log),
			mac: undefined,
		}));

		try {
			await this.startPolling();
			await this.setAdapterConnectionState(true);
		} catch (err: any) {
			this.log.error(`Error while starting polling: ${err}`);
			await this.setAdapterConnectionState(false);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback - Callback function
	 */
	private onUnload(callback: () => void): void {
		try {
			this.stopPolling();
			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${(error as Error).message}`);
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param id - State ID
	 * @param state - State object
	 */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (state) {
			// The state was changed
			this.log.silly(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			if (state.ack === false) {
				// This is a command from the user (e.g., from the UI or other adapter)
				// and should be processed by the adapter
				this.log.debug(`User command received for ${id}: ${state.val}`);

				const mac = getMacFromStateId(id);
				if (!mac) {
					this.log.error(`Unable to extract MAC address from state ID: ${id}`);
					return;
				}

				const device = this.getDeviceByMac(mac);
				if (!device) {
					this.log.error(`No device found for MAC ${mac}`);
					return;
				}
				this.log.debug(`Command on ${id} → forwarding to device ${device.name} (${mac})`);

				try {
					if (id.endsWith("power")) {
						await device.controller.setPower(state.val as boolean);
					} else if (id.endsWith("targetTemperature")) {
						await device.controller.setTemperature(state.val as number);
					} else if (id.endsWith("operationMode")) {
						await device.controller.setMode(state.val as number);
					} else if (id.endsWith("fanSpeed")) {
						await device.controller.setFanSpeed(state.val as number);
					} else if (id.endsWith("vaneVerticalDirection")) {
						await device.controller.setVerticalVane(state.val as number);
					} else if (id.endsWith("vaneHorizontalDirection")) {
						await device.controller.setHorizontalVane(state.val as number);
					} else if (id.endsWith("remoteLock")) {
						await device.controller.setRemoteLock(state.val as number);
					} else if (id.endsWith("triggerBuzzer")) {
						await device.controller.triggerBuzzer();
						await this.setState(id, state.val, true); // set ACK to true
					} else {
						this.log.warn(`Unhandled command for state ${id}`);
						return;
					}
				} catch (err: any) {
					this.log.error(`Error executing command for ${mac}: ${err}`);
				}
			}
		} else {
			// The object was deleted or the state value has expired
			this.log.silly(`state ${id} deleted`);
		}
	}

	private validateConfig(): boolean {
		this.log.debug("Checking adapter settings...");

		// --- Validate polling interval ---
		if (!this.config.pollingInterval || this.config.pollingInterval < 15) {
			this.config.pollingInterval = 15;
			this.log.warn("Polling interval can't be set lower than 15 seconds. Now set to 15 seconds.");
		}

		// --- Validate devices array existence ---
		const devices = this.config.devices;
		if (!devices || !Array.isArray(devices)) {
			this.log.error("No valid devices configured. Please add at least one device.");
			return false;
		}

		// --- Filter invalid devices ---
		const cleanedDevices = devices.filter(d => d?.name?.trim() && d?.ip?.trim() && this.isValidIPv4(d.ip.trim()));

		if (cleanedDevices.length !== devices.length) {
			this.log.warn("Some device entries were invalid and have been removed.");
		}

		// Update config
		this.config.devices = cleanedDevices;

		// --- Check if at least one valid device remains ---
		if (this.config.devices.length === 0) {
			this.log.error("No valid devices configured. Please add at least one device.");
			return false;
		}

		return true;
	}

	private isValidIPv4(ip: string): boolean {
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

	private async setAdapterConnectionState(isConnected: boolean): Promise<void> {
		await this.setStateChangedAsync("info.connection", isConnected, true);
		this.setForeignState(`system.adapter.${this.namespace}.connected`, isConnected, true);
	}

	private getDeviceByMac(mac: string): Device | undefined {
		const noColMac = String(mac)
			.toLowerCase()
			.replace(/[^0-9a-f]/g, "");
		if (noColMac.length !== 12) {
			return undefined;
		}

		const colMac = noColMac.match(/.{1,2}/g)!.join(":");

		return this.devices.find(c => c.controller.parsedDeviceState?.mac === colMac);
	}

	private async startPolling(): Promise<void> {
		const interval = this.config.pollingInterval * 1000;

		for (const device of this.devices) {
			const poll = async (): Promise<void> => {
				try {
					this.log.debug(`Polling ${device.name} (${device.ip}) ...`);

					const parsed = await device.controller.fetchStatus();
					device.mac = parsed.mac;

					await this.updateDeviceStates(this, parsed, device.name);
					await this.setDeviceOnlineState(device.mac, true);
				} catch (err: any) {
					this.log.error(`Polling error for ${device.name}: ${err}`);
					await this.setDeviceOnlineState(device.mac, false);
				}
			};

			await poll();
			device.pollingJob = setInterval(poll, interval);
		}

		this.log.info(`Started polling all devices every ${this.config.pollingInterval} seconds.`);
	}

	private stopPolling(): void {
		this.devices.forEach(c => {
			if (c.pollingJob) {
				clearTimeout(c.pollingJob);
				this.log.debug(`Cleared polling timer for device ${c.name}.`);
			}
			c.controller.cleanupController();
		});
	}

	private async setDeviceOnlineState(mac: string | undefined, isOnline: boolean): Promise<void> {
		if (mac) {
			await this.setState(`${this.namespace}.devices.${mac.replace(/:/g, "")}.info.deviceOnline`, {
				val: isOnline,
				ack: true,
			});
		}
	}

	private enumToStates(enumObj: any): Record<string, string> {
		const res: Record<string, string> = {};
		for (const key of Object.keys(enumObj)) {
			const v = enumObj[key];
			if (typeof v === "number") {
				res[v] = this.enumName(enumObj, v) ?? key;
			}
		}
		return res;
	}

	private isEnumValue(enumObj: any, value: number): boolean {
		return Object.values(enumObj).includes(value);
	}

	private enumName(enumObj: any, value: number): string {
		return enumObj[value] ?? value.toString();
	}

	/**
	 * Aktualisiert die ioBroker-Objekte für ein ParsedDeviceState
	 */
	async writeRecursive(adapter: MitsubishiLocalControl, parentId: string, obj: any): Promise<void> {
		for (const key of Object.keys(obj)) {
			const value = obj[key];

			if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
				await this.writeRecursive(adapter, parentId, value);
				continue;
			}

			let type: ioBroker.CommonType = "string";
			let name = key;
			let role = "state";
			let unit: string | undefined = undefined;
			let states: Record<string, string> | undefined;
			let read = true;
			let write = false;

			// Enum-Mapping
			switch (key) {
				case "power":
					if (typeof value === "boolean") {
						type = "boolean";
						role = "switch.power";
						name = "Power";
						write = true;
					}
					break;

				case "operationMode":
					if (this.isEnumValue(OperationMode, value)) {
						type = "number";
						states = this.enumToStates(OperationMode);
						role = "level.mode.airconditioner";
						name = "Operation Mode";
						write = true;
					}
					break;

				case "fanSpeed":
					if (this.isEnumValue(FanSpeed, value)) {
						type = "number";
						states = this.enumToStates(FanSpeed);
						role = "level.mode.fan";
						name = "Fan speed (while in manual mode)";
						write = true;
					}
					break;

				case "vaneVerticalDirection":
					if (this.isEnumValue(VaneVerticalDirection, value)) {
						type = "number";
						states = this.enumToStates(VaneVerticalDirection);
						role = "level";
						name = "Vane vertical direction";
						write = true;
					}
					break;

				case "vaneHorizontalDirection":
					if (this.isEnumValue(VaneHorizontalDirection, value)) {
						type = "number";
						states = this.enumToStates(VaneHorizontalDirection);
						role = "level";
						name = "Vane horizontal direction";
						write = true;
					}
					break;

				case "autoMode":
					if (this.isEnumValue(AutoMode, value)) {
						type = "number";
						states = this.enumToStates(AutoMode);
						role = "mode";
						name = "Auto mode";
					}
					break;

				case "remoteLock":
					if (this.isEnumValue(RemoteLock, value)) {
						type = "number";
						states = this.enumToStates(RemoteLock);
						write = true;
						name = "Remote lock";
					}
					break;

				case "triggerBuzzer":
					if (typeof value === "boolean") {
						type = "boolean";
						role = "button";
						read = false;
						write = true;
						name = "Trigger buzzer";
					}
					break;

				default:
					// Standardwerte bestimmen
					if (typeof value === "number") {
						const keyLower = key.toLowerCase();
						type = "number";

						if (keyLower.includes("temperature")) {
							role = "value.temperature";
							unit = "°C";

							if (keyLower.includes("targettemperature")) {
								write = true;
								role = "level.temperature";
								name = "Traget temperature";
							}
						} else if (keyLower.includes("power") || keyLower.includes("energy")) {
							role = "value.power";

							if (keyLower.includes("energy")) {
								unit = "kWh";
							}
						} else if (keyLower.includes("errorcode")) {
							states = { 32768: "No error" };
							role = "value";
						} else {
							role = "value";
						}
					} else if (typeof value === "boolean") {
						type = "boolean";
						role = "indicator";
					}
			}

			// State Objekt erstellen
			const id = write ? `${parentId}.control.${key}` : `${parentId}.info.${key}`;

			await adapter.setObjectNotExistsAsync(id, {
				type: "state",
				common: {
					name: name,
					type,
					role,
					unit,
					read: read,
					write: write,
					...(states ? { states } : {}),
				},
				native: {},
			});

			if (write) {
				this.subscribeStates(id);
			}

			// State setzen
			await adapter.setState(id, { val: value, ack: true });
		}
	}

	async updateDeviceStates(
		adapter: MitsubishiLocalControl,
		parsedState: ParsedDeviceState,
		deviceName: string,
	): Promise<void> {
		const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;

		await adapter.setObjectNotExistsAsync(`${deviceId}`, {
			type: "device",
			common: {
				statusStates: {
					onlineId: `${this.namespace}.${deviceId}.info.deviceOnline`,
					errorId: `${this.namespace}.${deviceId}.info.hasError`,
				},
				name: `${deviceName}`,
			},
			native: {},
		});

		await adapter.setObjectNotExistsAsync(`${deviceId}.control`, {
			type: "channel",
			common: { name: "Device control" },
			native: {},
		});

		await adapter.setObjectNotExistsAsync(`${deviceId}.info`, {
			type: "channel",
			common: { name: "Device information" },
			native: {},
		});

		await adapter.setObjectNotExistsAsync(`${deviceId}.info.deviceOnline`, {
			type: "state",
			common: {
				name: "Is device online",
				type: "boolean",
				role: "indicator.reachable",
				read: true,
				write: false,
				desc: "Indicates if device is reachable",
				def: false,
			},
			native: {},
		});

		await adapter.setObjectNotExistsAsync(`${deviceId}.info.hasError`, {
			type: "state",
			common: {
				name: "Has device an error",
				type: "boolean",
				role: "indicator.error",
				read: true,
				write: false,
				desc: "Indicates if device has an error",
				def: false,
			},
			native: {},
		});

		await this.writeRecursive(adapter, deviceId, parsedState);

		// Set error state according to error code
		await adapter.setState(`${deviceId}.info.hasError`, { val: parsedState.errors?.isAbnormalState, ack: true });
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MitsubishiLocalControl(options);
} else {
	// otherwise start the instance directly
	(() => new MitsubishiLocalControl())();
}
