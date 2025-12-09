// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

import { getMacFromStateId } from "./lib/mitsubishi/utils";

import { MitsubishiController } from "./lib/mitsubishi/mitsubishiController";
import type { ParsedDeviceState } from "./lib/mitsubishi/types";
import {
	AutoMode,
	DriveMode,
	HorizontalWindDirection,
	PowerOnOff,
	RemoteLock,
	VerticalWindDirection,
	WindSpeed,
} from "./lib/mitsubishi/types";

interface Device {
	name: string;
	ip: string;
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

		this.log.info(`Configuring ${this.config.devices.length} devices...`);

		this.devices = (this.config.devices ?? []).map(c => ({
			...c,
			controller: MitsubishiController.create(c.ip, this.log),
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
					if (id.endsWith("powerOnOff")) {
						await device.controller.setPower(state.val as boolean);
					} else if (id.endsWith("fineTemperature")) {
						await device.controller.setTemperature(state.val as number);
					} else if (id.endsWith("driveMode")) {
						await device.controller.setMode(state.val as number);
					} else if (id.endsWith("windSpeed")) {
						await device.controller.setFanSpeed(state.val as number);
					} else if (id.endsWith("verticalWindDirection")) {
						await device.controller.setVerticalVane(state.val as number);
					} else if (id.endsWith("horizontalWindDirection")) {
						await device.controller.setHorizontalVane(state.val as number);
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

		// Check polling interval
		if (this.config.pollingInterval < 15) {
			this.config.pollingInterval = 15;
			this.log.warn("Polling interval can't be set lower than 15 seconds. Now set to 15 seconds.");
		}

		// Check for valid devices
		if (!this.config.devices || !Array.isArray(this.config.devices)) {
			this.log.error("No valid devices configured. Please add at least one device.");
			return false;
		}

		const invalidDevices = this.config.devices.filter(c => !c.name || !c.ip || !c.name.trim() || !c.ip.trim());

		if (invalidDevices.length > 0) {
			// Leere Einträge entfernen
			this.config.devices = this.config.devices.filter(c => c.name && c.ip);

			if (this.config.devices.length === 0) {
				this.log.error("No valid devices configured. Please add at least one device.");
				return false;
			}
			this.log.warn("Some device entries are empty and will be ignored.");
		} else {
			this.log.error("No valid devices configured. Please add at least one device.");
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

					await this.updateDeviceStates(this, parsed, device.name);
				} catch (err: any) {
					this.log.error(`Polling error for ${device.name}: ${err}`);
				} finally {
					device.pollingJob = setTimeout(poll, interval);
				}
			};

			await poll();
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
			const id = `${parentId}.${key}`;

			if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
				// Channel
				await adapter.setObjectNotExistsAsync(id, {
					type: "channel",
					common: { name: key },
					native: {},
				});
				await this.writeRecursive(adapter, id, value);
				continue;
			}

			let type: ioBroker.CommonType = "string";
			let role = "state";
			let unit: string | undefined = undefined;
			let states: Record<string, string> | undefined;
			let write = false;

			// Enum-Mapping
			switch (key) {
				case "powerOnOff":
					if (this.isEnumValue(PowerOnOff, value)) {
						type = "number";
						states = this.enumToStates(PowerOnOff);
						role = "switch.power";
						write = true;
					}
					break;

				case "driveMode":
					if (this.isEnumValue(DriveMode, value)) {
						type = "number";
						states = this.enumToStates(DriveMode);
						role = "mode";
						write = true;
					}
					break;

				case "windSpeed":
					if (this.isEnumValue(WindSpeed, value)) {
						type = "number";
						states = this.enumToStates(WindSpeed);
						role = "level";
						write = true;
					}
					break;

				case "verticalWindDirection":
					if (this.isEnumValue(VerticalWindDirection, value)) {
						type = "number";
						states = this.enumToStates(VerticalWindDirection);
						role = "level";
						write = true;
					}
					break;

				case "horizontalWindDirection":
					if (this.isEnumValue(HorizontalWindDirection, value)) {
						type = "number";
						states = this.enumToStates(HorizontalWindDirection);
						role = "level";
						write = true;
					}
					break;

				case "autoMode":
					if (this.isEnumValue(AutoMode, value)) {
						type = "number";
						states = this.enumToStates(AutoMode);
						role = "mode";
					}
					break;

				case "remoteLock":
					if (this.isEnumValue(RemoteLock, value)) {
						type = "number";
						states = this.enumToStates(RemoteLock);
						role = "state";
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
							if (keyLower.includes("finetemperature")) {
								write = true;
							}
						} else if (keyLower.includes("power") || keyLower.includes("energy")) {
							role = "value.power";

							if (keyLower.includes("energy")) {
								unit = "kWh";
							}
						} else {
							role = "value";
						}
					} else if (typeof value === "boolean") {
						type = "boolean";
						role = "indicator";
					}
			}

			// State Objekt erstellen
			await adapter.setObjectNotExistsAsync(id, {
				type: "state",
				common: {
					name: key,
					type,
					role,
					unit,
					read: true,
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
			type: "channel",
			common: { name: `${deviceName}` },
			native: {},
		});

		await this.writeRecursive(adapter, `${deviceId}`, parsedState);
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MitsubishiLocalControl(options);
} else {
	// otherwise start the instance directly
	(() => new MitsubishiLocalControl())();
}
