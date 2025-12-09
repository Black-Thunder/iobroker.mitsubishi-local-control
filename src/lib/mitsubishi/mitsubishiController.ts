import { Buffer } from "buffer";
import { XMLParser } from "fast-xml-parser";

import { MitsubishiAPI } from "./mitsubishiApi";
import type { HorizontalWindDirection, VerticalWindDirection, WindSpeed, DriveMode } from "./types";
import { Controls, Controls08, GeneralStates, ParsedDeviceState, PowerOnOff } from "./types";

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

	setPower(power: PowerOnOff): void {
		this.desiredState.powerOnOff = power;
		this.changes |= Controls.PowerOnOff;
	}

	setMode(driveMode: DriveMode): void {
		this.desiredState.driveMode = driveMode as number;
		this.changes |= Controls.DriveMode;
	}

	setTemperature(temperature: number): void {
		this.desiredState.temperature = temperature;
		this.changes |= Controls.Temperature;
	}

	setDehumidifier(humidity: number): void {
		this.desiredState.dehumSetting = humidity;
		this.changes08 |= Controls08.Dehum;
	}

	setFanSpeed(fanSpeed: WindSpeed): void {
		this.desiredState.windSpeed = fanSpeed;
		this.changes |= Controls.WindSpeed;
	}

	setVerticalVane(vVane: VerticalWindDirection): void {
		this.desiredState.verticalWindDirection = vVane;
		this.changes |= Controls.UpDownWindDirection;
	}

	setHorizontalVane(hVane: HorizontalWindDirection): void {
		this.desiredState.horizontalWindDirection = hVane;
		this.changes |= Controls.LeftRightWindDirect;
	}

	setPowerSaving(powerSaving: boolean): void {
		this.desiredState.isPowerSaving = powerSaving;
		this.changes08 |= Controls08.PowerSaving;
	}
}

/**
 * Controller that uses MitsubishiAPI to fetch status and apply controls
 */
export class MitsubishiController {
	public parsedDeviceState: ParsedDeviceState | null = null;

	private log: ioBroker.Logger;
	private api: MitsubishiAPI;
	private profile_code: Buffer[] = [];
	static waitTimeAfterCommand = 5000;

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

	async fetchStatus(): Promise<ParsedDeviceState> {
		const resp = await this.api.sendStatusRequest();
		this.parsedDeviceState = this.parsedDeviceState ?? new ParsedDeviceState();
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
			this.parsedDeviceState.app_version = appVer.toString();
		}

		// ---- 4: Extract PROFILECODE values (two possible locations like Python) ----
		this.profile_code = [];

		const profiles1 = this.extractTagList(rootObj, ["PROFILECODE", "DATA", "VALUE"]);
		const profiles2 = this.extractTagList(rootObj, ["PROFILECODE", "VALUE"]);

		const mergedProfiles = [...profiles1, ...profiles2];

		for (const hex of mergedProfiles) {
			try {
				this.profile_code.push(Buffer.from(hex, "hex"));
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

	private async applyHexCommand(hex: string): Promise<string> {
		const resp = await this.api.sendHexCommand(hex);
		// wait a bit to let the device update if necessary
		await new Promise(r => setTimeout(r, MitsubishiController.waitTimeAfterCommand));
		return resp;
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
		let newState = undefined;

		if (changeset.changes !== Controls.NoControl) {
			newState = await this.sendGeneralCommand(changeset.desiredState, changeset.changes);
		} else if (changeset.changes08 !== Controls08.NoControl) {
			newState = await this.sendExtend08Command(changeset.desiredState, changeset.changes08);
		}

		return newState;
	}

	async setPower(on: boolean): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setPower(on ? PowerOnOff.ON : PowerOnOff.OFF);
		return this.applyChangeset(changeset);
	}

	async setTemperature(tempC: number): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setTemperature(tempC);
		return this.applyChangeset(changeset);
	}

	async setMode(mode: DriveMode): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setMode(mode);
		return this.applyChangeset(changeset);
	}

	async setFanSpeed(speed: WindSpeed): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setFanSpeed(speed);
		return this.applyChangeset(changeset);
	}

	async setVerticalVane(v: VerticalWindDirection): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		changeset.setVerticalVane(v);
		return this.applyChangeset(changeset);
	}

	async setHorizontalVane(h: HorizontalWindDirection): Promise<ParsedDeviceState | undefined> {
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

	/*async sendBuzzerCommand(enabled = true): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		const s = this.parsedDeviceState ?? new ParsedDeviceState();
		const buf = s.general.generateExtend08Command(Controls08.Buzzer);
		return this.applyHexCommand(buf.toString("hex"));
	}

	async setRemoteLock(lockFlags: number): Promise<ParsedDeviceState | undefined> {
		const changeset = await this.getChangeset();
		const s = this.parsedDeviceState ?? new ParsedDeviceState();
		s.general.remoteLock = lockFlags;
		const buf = s.general.generateGeneralCommand(Controls.RemoteLock);
		return this.applyHexCommand(buf.toString("hex"));
	}*/

	private async sendGeneralCommand(state: GeneralStates, controls: Controls): Promise<ParsedDeviceState> {
		const buf = state.generateGeneralCommand(controls);
		this.log.debug(`Sending General Command: ${buf.toString("hex")}`);
		const response = await this.applyHexCommand(buf.toString("hex"));

		return this.parseStatusResponse(response);
	}

	private async sendExtend08Command(state: GeneralStates, controls: Controls08): Promise<ParsedDeviceState> {
		const buf = state.generateExtend08Command(controls);
		this.log.debug(`Sending Extend08 Command: ${buf.toString("hex")}`);
		const response = await this.applyHexCommand(buf.toString("hex"));

		return this.parseStatusResponse(response);
	}

	async enableEchonet(): Promise<string> {
		return this.api.sendEchonetEnable();
	}

	async reboot(): Promise<string> {
		return this.api.sendRebootRequest();
	}
}
