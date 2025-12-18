import { Mutex } from "async-mutex";
import { Buffer } from "buffer";
import { XMLParser } from "fast-xml-parser";

import { MitsubishiAPI } from "./mitsubishiApi";
import type { FanSpeed, OperationMode, RemoteLock, VaneHorizontalDirection, VaneVerticalDirection } from "./types";
import { Controls, Controls08, GeneralStates, ParsedDeviceState } from "./types";

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	trimValues: true,
});

export class MitsubishiChangeSet {
	public desiredState: GeneralStates;
	public changes: Controls;
	public changes08: Controls08;

	constructor(currentState: GeneralStates) {
		this.desiredState = new GeneralStates(currentState);
		this.changes = Controls.NoControl;
		this.changes08 = Controls08.NoControl;
	}

	get empty(): boolean {
		return this.changes === Controls.NoControl && this.changes08 === Controls08.NoControl;
	}

	setPower(power: boolean): void {
		this.desiredState.power = power;
		this.changes |= Controls.Power;
	}

	setMode(operationMode: OperationMode): void {
		this.desiredState.operationMode = operationMode as number;
		this.changes |= Controls.OperationMode;
	}

	setTemperature(temperature: number): void {
		this.desiredState.temperature = temperature;
		this.changes |= Controls.Temperature;
	}

	setDehumidifier(humidity: number): void {
		this.desiredState.dehumidifierLevel = humidity;
		this.changes08 |= Controls08.Dehum;
	}

	setFanSpeed(fanSpeed: FanSpeed): void {
		this.desiredState.fanSpeed = fanSpeed;
		this.changes |= Controls.FanSpeed;
	}

	setVerticalVane(vVane: VaneVerticalDirection): void {
		this.desiredState.vaneVerticalDirection = vVane;
		this.changes |= Controls.VaneVerticalDirection;
	}

	setHorizontalVane(hVane: VaneHorizontalDirection): void {
		this.desiredState.vaneHorizontalDirection = hVane;
		this.changes |= Controls.VaneHorizontalDirection;
	}

	setPowerSaving(powerSaving: boolean): void {
		this.desiredState.powerSaving = powerSaving;
		this.changes08 |= Controls08.PowerSaving;
	}

	setRemoteLock(remoteLock: RemoteLock): void {
		this.desiredState.remoteLock = remoteLock;
		this.changes |= Controls.RemoteLock;
	}

	triggerBuzzer(): void {
		this.desiredState.triggerBuzzer = true;
		this.changes08 |= Controls08.Buzzer;
	}
}

/**
 * Controller that uses MitsubishiAPI to fetch status and apply controls
 */
export class MitsubishiController {
	public parsedDeviceState: ParsedDeviceState | null = null;
	public isCommandInProgress = false;

	private log: ioBroker.Logger;
	private api: MitsubishiAPI;
	private readonly mutex = new Mutex();
	private readonly commandQueue: Array<() => Promise<ParsedDeviceState>> = [];
	private isProcessingQueue = false;
	private profileCode: Buffer[] = [];

	static waitTimeAfterCommand = 6000;

	constructor(api: MitsubishiAPI, log: ioBroker.Logger) {
		this.api = api;
		this.log = log;
	}

	public static create(
		deviceHostPort: string,
		log: ioBroker.Logger,
		encryptionKey?: string | Buffer,
	): MitsubishiController {
		const api = new MitsubishiAPI(deviceHostPort, log, encryptionKey);
		return new MitsubishiController(api, log);
	}

	public cleanupController(): void {
		this.api.close();
	}

	async fetchStatus(useLock = true): Promise<ParsedDeviceState> {
		if (useLock) {
			return this.withLock(async () => {
				const resp = await this.api.sendStatusRequest();
				const parsedResp = this.parseStatusResponse(resp);
				return parsedResp;
			});
		}

		const resp = await this.api.sendStatusRequest();
		const parsedResp = this.parseStatusResponse(resp);
		return parsedResp;
	}

	parseStatusResponse(xml: string): ParsedDeviceState {
		// Parse XML into JS object
		const parsed = xmlParser.parse(xml);

		// expected shape: { CSV: { ... } } or { LSV: { ... } }
		const rootObj = parsed.CSV || parsed.LSV || parsed.ESV || parsed;

		// ---- 1: Extract all CODE/VALUE entries ----
		const codeValues: string[] = [];

		function collectCodeValues(node: any): void {
			if (!node || typeof node !== "object") {
				return;
			}
			if (node.CODE?.VALUE) {
				const v = node.CODE.VALUE;
				if (Array.isArray(v)) {
					v.forEach(entry => entry && codeValues.push(entry));
				} else if (typeof v === "string") {
					codeValues.push(v);
				}
			}
			for (const key of Object.keys(node)) {
				const value = node[key];
				if (typeof value === "object") {
					collectCodeValues(value);
				}
			}
		}

		collectCodeValues(rootObj);

		// ---- 2: Parse device state from code values ----
		this.parsedDeviceState = ParsedDeviceState.parseCodeValues(codeValues);

		// ---- 3: Extract MAC, SERIAL, RSSI and APP_VER ----
		const mac = this.extractTag(rootObj, "MAC");
		if (mac) {
			this.parsedDeviceState.mac = mac;
		}

		const serial = this.extractTag(rootObj, "SERIAL");
		if (serial) {
			this.parsedDeviceState.serial = serial;
		}

		const rssi = this.extractTag(rootObj, "RSSI");
		if (rssi) {
			this.parsedDeviceState.rssi = rssi.toString();
		}
		const appVer = this.extractTag(rootObj, "APP_VER");
		if (appVer) {
			this.parsedDeviceState.appVersion = appVer.toString();
		}

		// ---- 4: Extract PROFILECODE values (two possible locations like Python) ----
		this.profileCode = [];

		const profiles1 = this.extractTagList(rootObj, ["PROFILECODE", "DATA", "VALUE"]);
		const profiles2 = this.extractTagList(rootObj, ["PROFILECODE", "VALUE"]);

		const mergedProfiles = [...profiles1, ...profiles2];

		for (const hex of mergedProfiles) {
			try {
				this.profileCode.push(Buffer.from(hex, "hex"));
			} catch {
				// ignore malformed entries exactly like python would
			}
		}

		this.parsedDeviceState.ip = this.api.getDeviceHostPort();

		return this.parsedDeviceState;
	}

	/**
	 * Helper: find a single tag with direct text content
	 */
	private extractTag(obj: any, tag: string): string | null {
		if (!obj || typeof obj !== "object") {
			return null;
		}

		if (obj[tag] && (typeof obj[tag] === "string" || typeof obj[tag] === "number")) {
			return obj[tag].toString();
		}

		for (const key of Object.keys(obj)) {
			const res = this.extractTag(obj[key], tag);
			if (res) {
				return res;
			}
		}

		return null;
	}

	/**
	 * Helper: find nested tag list path e.g. ["PROFILECODE","DATA","VALUE"]
	 */
	private extractTagList(obj: any, path: string[]): string[] {
		const result: string[] = [];

		function recursive(node: any, pathIndex: number): void {
			if (!node || typeof node !== "object") {
				return;
			}

			if (pathIndex === path.length) {
				// final target
				if (typeof node === "string") {
					result.push(node);
				} else if (Array.isArray(node)) {
					node.forEach(v => typeof v === "string" && result.push(v));
				}
				return;
			}

			const key = path[pathIndex];
			if (node[key] !== undefined) {
				recursive(node[key], pathIndex + 1);
			}

			// continue scanning in case the structure is repeated in deeper layers
			for (const k of Object.keys(node)) {
				recursive(node[k], pathIndex);
			}
		}

		recursive(obj, 0);
		return result;
	}

	private async applyHexCommand(hex: string): Promise<ParsedDeviceState> {
		return this.withLock(async () => {
			try {
				this.isCommandInProgress = true;
				await this.api.sendHexCommand(hex);

				// Wait for device to process the command
				await new Promise(r => setTimeout(r, MitsubishiController.waitTimeAfterCommand));

				// Fetch fresh status after device has processed
				const newState = await this.fetchStatus(false);

				return newState;
			} finally {
				this.isCommandInProgress = false;
			}
		});
	}

	private async ensureDeviceState(): Promise<void> {
		if (!this.parsedDeviceState || !this.parsedDeviceState.general) {
			await this.fetchStatus();
		}
	}

	private async getChangeset(): Promise<MitsubishiChangeSet> {
		await this.ensureDeviceState();
		return new MitsubishiChangeSet(this.parsedDeviceState?.general ?? new GeneralStates());
	}

	private async applyChangeset(changeset: MitsubishiChangeSet): Promise<ParsedDeviceState | undefined> {
		try {
			// Add command to queue and return a promise that resolves when done
			return await new Promise((/*resolve, reject*/) => {
				this.commandQueue.push(async () => {
					//try {
					let newState: ParsedDeviceState | undefined;

					if (changeset.changes !== Controls.NoControl) {
						newState = await this.sendGeneralCommand(changeset.desiredState, changeset.changes);
					} else if (changeset.changes08 !== Controls08.NoControl) {
						newState = await this.sendExtend08Command(changeset.desiredState, changeset.changes08);
					}

					// Verify that the command was accepted
					if (newState /*&& this.verifyCommandAccepted(changeset, newState)*/) {
						//resolve(newState);
						return newState;
					}
					throw new Error("Device did not apply the command");
					//} catch (error) {
					//reject(error);
					//	throw error;
					//}
				});

				// Start processing the command queue if not already running
				void this.processCommandQueue();
			});
		} catch {
			//this.log.error(`Failed to apply changeset: ${(error as Error).message}`);
			//throw error;
		}
	}

	private async processCommandQueue(): Promise<void> {
		// Prevent concurrent processing
		if (this.isProcessingQueue || this.commandQueue.length === 0) {
			return;
		}

		this.isProcessingQueue = true;
		try {
			while (this.commandQueue.length > 0) {
				const nextCommand = this.commandQueue.shift();
				if (nextCommand) {
					try {
						await nextCommand();
					} catch {
						// error was already in reject() handled
						// Here only log, not rethrow
						//this.log.warn(`Command in queue failed: ${(error as Error).message}`);
					}
					// Wait after each command to prevent polling conflicts
					await new Promise(r => setTimeout(r, 500));
				}
			}
		} finally {
			this.isProcessingQueue = false;
		}
	}

	private verifyCommandAccepted(changeset: MitsubishiChangeSet, newState: ParsedDeviceState): boolean {
		if (!newState.general) {
			return false;
		}

		// Verify based on what was changed
		if (changeset.changes & Controls.Power) {
			if (newState.general.power !== changeset.desiredState.power) {
				this.log.warn(
					`Power command not accepted by device. Desired: ${changeset.desiredState.power}, Got: ${newState.general.power}`,
				);
				return false;
			}
		}

		if (changeset.changes & Controls.Temperature) {
			if (Math.abs(newState.general.temperature - changeset.desiredState.temperature) > 0.5) {
				this.log.warn(
					`Temperature command not accepted by device. Desired: ${changeset.desiredState.temperature}, Got: ${newState.general.temperature}`,
				);
				return false;
			}
		}

		if (changeset.changes & Controls.OperationMode) {
			if (newState.general.operationMode !== changeset.desiredState.operationMode) {
				this.log.warn(
					`Mode command not accepted by device. Desired: ${changeset.desiredState.operationMode}, Got: ${newState.general.operationMode}`,
				);
				return false;
			}
		}

		if (changeset.changes & Controls.FanSpeed) {
			if (newState.general.fanSpeed !== changeset.desiredState.fanSpeed) {
				this.log.warn(
					`Fan speed command not accepted by device. Desired: ${changeset.desiredState.fanSpeed}, Got: ${newState.general.fanSpeed}`,
				);
				return false;
			}
		}

		if (changeset.changes & Controls.VaneHorizontalDirection) {
			if (newState.general.vaneHorizontalDirection !== changeset.desiredState.vaneHorizontalDirection) {
				this.log.warn(
					`Vane horizontal direction command not accepted by device. Desired: ${changeset.desiredState.vaneHorizontalDirection}, Got: ${newState.general.vaneHorizontalDirection}`,
				);
				return false;
			}
		}

		if (changeset.changes & Controls.VaneVerticalDirection) {
			if (newState.general.vaneVerticalDirection !== changeset.desiredState.vaneVerticalDirection) {
				this.log.warn(
					`Vane vertical direction command not accepted by device. Desired: ${changeset.desiredState.vaneVerticalDirection}, Got: ${newState.general.vaneVerticalDirection}`,
				);
				return false;
			}
		}

		return true;
	}

	async setPower(on: boolean): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setPower(on);
		return this.applyChangeset(changeset);
	}

	async setTemperature(tempC: number): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setTemperature(tempC);
		return this.applyChangeset(changeset);
	}

	async setMode(mode: OperationMode): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setMode(mode);
		return this.applyChangeset(changeset);
	}

	async setFanSpeed(speed: FanSpeed): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setFanSpeed(speed);
		return this.applyChangeset(changeset);
	}

	async setVerticalVane(v: VaneVerticalDirection): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setVerticalVane(v);
		return this.applyChangeset(changeset);
	}

	async setHorizontalVane(h: VaneHorizontalDirection): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setHorizontalVane(h);
		return this.applyChangeset(changeset);
	}

	async setDehumidifier(setting: number): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setDehumidifier(setting);
		return this.applyChangeset(changeset);
	}

	async setPowerSaving(enabled: boolean): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setPowerSaving(enabled);
		return this.applyChangeset(changeset);
	}

	async triggerBuzzer(): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.triggerBuzzer();
		return this.applyChangeset(changeset);
	}

	async setRemoteLock(lockFlags: RemoteLock): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setRemoteLock(lockFlags);
		return this.applyChangeset(changeset);
	}

	private async sendGeneralCommand(state: GeneralStates, controls: Controls): Promise<ParsedDeviceState> {
		const buf = state.generateGeneralCommand(controls);
		this.log.debug(`Sending General Command: ${buf.toString("hex")}`);
		return this.applyHexCommand(buf.toString("hex"));
	}

	private async sendExtend08Command(state: GeneralStates, controls: Controls08): Promise<ParsedDeviceState> {
		const buf = state.generateExtend08Command(controls);
		this.log.debug(`Sending Extend08 Command: ${buf.toString("hex")}`);
		return this.applyHexCommand(buf.toString("hex"));
	}

	async enableEchonet(): Promise<string> {
		return this.api.sendEchonetEnable();
	}

	async reboot(): Promise<string> {
		return this.api.sendRebootRequest();
	}

	private async withLock<T>(fn: () => Promise<T>): Promise<T> {
		return this.mutex.runExclusive(fn);
	}
}
