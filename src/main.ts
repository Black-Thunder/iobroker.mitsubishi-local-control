// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

import { enumToStates, getMacFromStateId, isEnumValue, isValidIPv4 } from "./lib/mitsubishi/utils";

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
					} else if (id.endsWith("powerSaving")) {
						await device.controller.setPowerSaving(state.val as boolean);
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
					} else if (id.endsWith("dehumidifierLevel")) {
						await device.controller.setDehumidifier(state.val as number);
					} else if (id.endsWith("triggerBuzzer")) {
						await device.controller.triggerBuzzer();
					} else {
						this.log.warn(`Unhandled command for state ${id}`);
						return;
					}
				} catch (err: any) {
					this.log.error(`Error executing command for ${device.name}: ${err}`);
				}

				await this.setState(id, state.val, true); // command was confirmed by device, set ACK to true
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
		const cleanedDevices = devices.filter(d => d?.name?.trim() && d?.ip?.trim() && isValidIPv4(d.ip.trim()));

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
				if (device.controller.isCommandInProgress) {
					this.log.debug(`Skipping poll for ${device.name}: command in progress`);
					return;
				}

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
				clearInterval(c.pollingJob);
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
			let desc: string | undefined = undefined;
			let role = "state";
			let unit: string | undefined = undefined;
			let states: Record<string, string> | undefined;
			let read = true;
			let write = false;
			let min: number | undefined = undefined;
			let max: number | undefined = undefined;

			//// Map ParsedDeviceState keys to proper states
			// Map enums
			switch (key) {
				case "operationMode":
					if (isEnumValue(OperationMode, value)) {
						type = "number";
						states = enumToStates(OperationMode);
						role = "level.mode.airconditioner";
						name = "Operation Mode";
						desc = "Sets the operation mode of the device";
						write = true;
					}
					break;

				case "fanSpeed":
					if (isEnumValue(FanSpeed, value)) {
						type = "number";
						states = enumToStates(FanSpeed);
						role = "level.mode.fan";
						name = "Fan speed";
						desc = "Sets the fan speed when in manual mode";
						write = true;
					}
					break;

				case "vaneVerticalDirection":
					if (isEnumValue(VaneVerticalDirection, value)) {
						type = "number";
						states = enumToStates(VaneVerticalDirection);
						role = "level";
						name = "Vane vertical direction";
						desc = "Sets the vertical direction of the vane";
						write = true;
					}
					break;

				case "vaneHorizontalDirection":
					if (isEnumValue(VaneHorizontalDirection, value)) {
						type = "number";
						states = enumToStates(VaneHorizontalDirection);
						role = "level";
						name = "Vane horizontal direction";
						desc = "Sets the horizontal direction of the vane";
						write = true;
					}
					break;

				case "autoMode":
					if (isEnumValue(AutoMode, value)) {
						type = "number";
						states = enumToStates(AutoMode);
						role = "mode";
						name = "Auto mode";
						desc = "Current auto mode of the device";
					}
					break;

				case "remoteLock":
					if (isEnumValue(RemoteLock, value)) {
						type = "number";
						states = enumToStates(RemoteLock);
						write = true;
						name = "Remote lock";
						desc = "Sets the remote lock state of the device";
					}
					break;
				// Map other types
				default:
					if (typeof value === "number") {
						const keyLower = key.toLowerCase();
						type = "number";
						desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);

						if (keyLower.includes("temperature")) {
							role = "value.temperature";
							unit = "°C";

							if (keyLower.includes("targettemperature")) {
								write = true;
								role = "level.temperature";
								name = "Target temperature";
								desc = "Sets the target temperature of the device";
								min = 16;
								max = 31;
								unit = "°C";
							}
						} else if (keyLower.includes("dehumidifierlevel")) {
							write = true;
							name = "Dehumidifier level";
							desc = "Sets the dehumidifier level";
							unit = "%";
							min = 0;
							max = 100;
							role = "level.humidity";
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
						const keyLower = key.toLowerCase();
						type = "boolean";

						if (keyLower.includes("triggerbuzzer")) {
							role = "button";
							name = "Trigger buzzer";
							desc = "Triggers the device buzzer";
							read = false;
							write = true;
						} else if (keyLower === "power") {
							role = "switch.power";
							name = "Power";
							desc = "Turns the device on or off";
							write = true;
						} else if (keyLower === "powersaving") {
							role = "switch";
							name = "Power saving";
							desc = "Enables or disables power saving mode";
							write = true;
						} else {
							role = "indicator";
						}
					} else if (typeof value === "string") {
						type = "string";
						role = "text";
						desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);
					}
			}

			// State Objekt erstellen
			const id = write ? `${parentId}.control.${key}` : `${parentId}.info.${key}`;

			await adapter.setObjectNotExistsAsync(id, {
				type: "state",
				common: {
					name: name,
					desc: desc,
					type,
					role,
					unit,
					read: read,
					write: write,
					min: min,
					max: max,
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

		// Generate device object and common states
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

		await adapter.setObjectNotExistsAsync(`${deviceId}.control.enableEchonet`, {
			type: "state",
			common: {
				name: "Enable ECHONET",
				type: "boolean",
				role: "button",
				read: false,
				write: true,
				desc: "Send enable ECHONET command",
				def: false,
			},
			native: {},
		});

		await adapter.setObjectNotExistsAsync(`${deviceId}.control.rebootDevice`, {
			type: "state",
			common: {
				name: "Reboot device",
				type: "boolean",
				role: "button",
				read: false,
				write: true,
				desc: "Send reboot device command",
				def: false,
			},
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

		// Generate states from ParsedDeviceState
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
