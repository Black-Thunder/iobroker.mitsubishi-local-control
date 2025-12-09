// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";

import { getMacFromStateId } from "./lib/mitsubishi/utils";

import { MitsubishiController } from "./lib/mitsubishi/mitsubishiController";
import {
	AutoMode,
	DriveMode,
	HorizontalWindDirection,
	ParsedDeviceState,
	PowerOnOff,
	RemoteLock,
	VerticalWindDirection,
	WindSpeed,
} from "./lib/mitsubishi/types";

interface Client {
	name: string;
	ip: string;
	controller: MitsubishiController;
	pollingJob?: NodeJS.Timeout;
}

class MitsubishiLocalControl extends utils.Adapter {
	private clients: Client[] = [];

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

		this.log.debug(`Configured Polling Interval: ${this.config.pollingInterval} seconds`);

		this.clients = (this.config.clients ?? []).map(c => ({
			...c,
			controller: MitsubishiController.create(c.ip, this.log),
		}));

		try {
			this.startPolling();
			await this.setAdapterConnectionState(true);
		} catch (err) {
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
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
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

				const client = this.getClientByMac(mac);
				if (!client) {
					this.log.error(`No client found for MAC ${mac}`);
					return;
				}
				this.log.debug(`Command on ${id} → forwarding to client ${client.name} (${mac})`);

				try {
					if (id.endsWith("powerOnOff")) {
						client.controller.setPower(state.val as boolean);
					}
				} catch (err) {
					this.log.error(`Error executing command for ${mac}: ${err}`);
				}
			}
		} else {
			// The object was deleted or the state value has expired
			this.log.silly(`state ${id} deleted`);
		}
	}

	private async setAdapterConnectionState(isConnected: boolean): Promise<void> {
		await this.setStateChangedAsync("info.connection", isConnected, true);
		await this.setForeignState(`system.adapter.${this.namespace}.connected`, isConnected, true);
	}

	private getClientByMac(mac: string): Client | undefined {
		const noColMac = String(mac)
			.toLowerCase()
			.replace(/[^0-9a-f]/g, "");
		if (noColMac.length !== 12) return undefined;

		const colMac = noColMac.match(/.{1,2}/g)!.join(":");

		return this.clients.find(c => c.controller.parsedDeviceState?.mac === colMac);
	}

	private startPolling(): void {
		let interval = this.config.pollingInterval * 1000;

		for (const client of this.clients) {
			const poll = async () => {
				try {
					this.log.debug(`Polling ${client.name} (${client.ip}) ...`);

					const parsed = await client.controller.fetchStatus();

					await this.updateDeviceStates(this, parsed, client.name);
				} catch (err) {
					this.log.error(`Polling error for ${client.name}: ${err}`);
				} finally {
					client.pollingJob = setTimeout(poll, interval);
				}

				/*if (this.isConnected) {
				this.retryCounter = 0;
				
			} else {
				if (this.retryCounter < maxRetries) {
					this.retryCounter++;
					this.adapter.log.warn(
						`Connection to MELCloud lost - reconnecting (try ${this.retryCounter} of ${maxRetries})...`,
					);
					pollingJob = setTimeout(updateData, jobInterval);
				} else {
					this.retryCounter = 0;
					this.adapter.log.error(
						"Connection to MELCloud lost, polling temporarily disabled! Trying again in one hour.",
					);
					pollingJob = setTimeout(updateData, retryInterval);
				}
			}*/
			};

			poll();
			this.log.debug(`Started polling timer for device ${client.name}.`);
		}
	}

	private stopPolling(): void {
		this.clients.forEach(c => {
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
	async writeRecursive(adapter: MitsubishiLocalControl, parentId: string, obj: any) {
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
			let val: any = value;
			let unit: string | undefined = undefined;
			let states: Record<string, string> | undefined;
			let write: boolean = false;

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
							if (keyLower == "fineTemperature") {
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
			await adapter.setState(id, { val, ack: true });
		}
	}

	async updateDeviceStates(adapter: MitsubishiLocalControl, parsedState: ParsedDeviceState, clientName: string) {
		const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;

		await adapter.setObjectNotExistsAsync(`${deviceId}`, {
			type: "channel",
			common: { name: `${clientName}` },
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
