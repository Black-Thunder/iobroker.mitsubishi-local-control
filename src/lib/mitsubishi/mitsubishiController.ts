import { Mutex } from "async-mutex";
import { Buffer } from "buffer";
import { XMLParser } from "fast-xml-parser";

import { MitsubishiAPI } from "./mitsubishiApi";
import { MitsubishiChangeSet } from "./mitsubishiChangeset";
import type { FanSpeed, OperationMode, RemoteLock, VaneHorizontalDirection, VaneVerticalDirection } from "./types";
import { Controls, Controls08, GeneralStates, ParsedDeviceState } from "./types";

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	trimValues: true,
});

/**
 * Controller that uses MitsubishiAPI to fetch status and apply controls
 */
export class MitsubishiController {
	public parsedDeviceState: ParsedDeviceState | null = null;
	public isCommandInProgress = false;

	private log: ioBroker.Logger;
	private api: MitsubishiAPI;
	private readonly mutex = new Mutex();
	private readonly commandQueue: Array<() => Promise<ParsedDeviceState | undefined>> = [];
	private isProcessingQueue = false;
	private profileCode: Buffer[] = [];
	private pendingChangeset: MitsubishiChangeSet | null = null;
	private pendingTimer: NodeJS.Timeout | null = null;
	private readonly coalesceDelayMs = 200;

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
		await this.ensureDeviceState();

		// Create or merge pending changeset
		if (!this.pendingChangeset) {
			this.pendingChangeset = changeset;
		} else {
			this.pendingChangeset.merge(changeset);
		}

		// Reset debounce timer
		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer);
		}

		return new Promise((resolve, reject) => {
			this.pendingTimer = setTimeout(() => {
				this.flushPendingChangeset().then(resolve).catch(reject);
			}, this.coalesceDelayMs);
		});
	}

	private async flushPendingChangeset(): Promise<ParsedDeviceState | undefined> {
		const changeset = this.pendingChangeset;
		this.pendingChangeset = null;
		this.pendingTimer = null;

		if (!changeset || changeset.empty) {
			return;
		}

		return new Promise((resolve, reject) => {
			this.commandQueue.push(async () => {
				try {
					let newState: ParsedDeviceState | undefined;

					if (changeset.changes !== Controls.NoControl) {
						newState = await this.sendGeneralCommand(changeset.desiredState, changeset.changes);
					} else if (changeset.changes08 !== Controls08.NoControl) {
						newState = await this.sendExtend08Command(changeset.desiredState, changeset.changes08);
					}

					resolve(newState);
					return newState;
				} catch (err) {
					this.log.warn(`Failed to send coalesced command: ${(err as Error).message}`);
					reject(err);
				}
			});

			void this.processCommandQueue();
		});
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
					} catch (error) {
						// error was already in reject() handled
						this.log.warn(`Command in queue failed: ${(error as Error).message}`);
					}
					// Wait after each command to prevent polling conflicts
					await new Promise(r => setTimeout(r, 500));
				}
			}
		} finally {
			this.isProcessingQueue = false;
		}
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

	async setOperationMode(mode: OperationMode): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setOperationMode(mode);
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
