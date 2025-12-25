import { calcFcc } from "./utils";

export const KEY_SIZE = 16;
export const STATIC_KEY = Buffer.from("unregistered\0\0\0\0", "utf8");

/* eslint-disable no-unused-vars */
export enum OperationMode {
	AUTO = 0,
	HEAT = 1,
	DRY = 2,
	COOL = 3,
	VENT = 7,
}

export enum FanSpeed {
	AUTO = 0,
	LOWEST = 1,
	LOW = 2,
	MEDIUM = 3,
	HIGH = 5,
	MAX = 6,
}

export enum VaneVerticalDirection {
	AUTO = 0,
	TOPMOST = 1,
	UP = 2,
	MIDDLE = 3,
	DOWN = 4,
	BOTTOMMOST = 5,
	SWING = 7,
}

export enum VaneHorizontalDirection {
	AUTO = 0,
	LEFTMOST = 1,
	LEFT = 2,
	MIDDLE = 3,
	RIGHT = 4,
	RIGHTMOST = 5,
	LEFT_CENTER = 6,
	CENTER_RIGHT = 7,
	LEFT_RIGHT = 8,
	LEFT_CENTER_RIGHT = 9,
	SWING = 12,
}

export enum AutoMode {
	OFF = 0,
	SWITCHING = 1,
	AUTO_HEATING = 2,
	AUTO_COOLING = 3,
}

export enum RemoteLock {
	UNLOCKED = 0,
	POWER_LOCKED = 1,
	MODE_LOCKED = 2,
	TEMPERATURE_LOCKED = 3,
}

export enum Controls {
	NoControl = 0x0000,
	Power = 0x0100,
	OperationMode = 0x0200,
	Temperature = 0x0400,
	FanSpeed = 0x0800,
	VaneVerticalDirection = 0x1000,
	RemoteLock = 0x4000,
	VaneHorizontalDirection = 0x0001,
	OutsideControl = 0x0002,
	// others omitted for brevity
}

export enum Controls08 {
	NoControl = 0x00,
	Dehum = 0x04,
	PowerSaving = 0x08,
	Buzzer = 0x10,
	WindAndWindBreak = 0x20,
}
/* eslint-enable no-unused-vars */

export class SensorStates {
	insideTemperature1Coarse: number = 24;
	outsideTemperature: number = 21.0;
	insideTemperature1Fine: number = 24.5;
	insideTemperature2: number = 24.0;
	runtimeMinutes: number = 0;

	static isSensorStatesPayload(data: Buffer): boolean {
		return data.length >= 6 && (data[1] === 0x62 || data[1] === 0x7b) && data[5] === 0x03;
	}

	static parseSensorStates(data: Buffer): SensorStates {
		if (data[0] !== 0xfc) {
			throw new Error("Invalid sensor payload");
		}
		if (data[5] !== 0x03) {
			throw new Error("Not sensor states");
		}

		const fcc = calcFcc(data.subarray(1, -1));
		if (fcc !== data[data.length - 1]) {
			throw new Error("Invalid checksum");
		}
		const obj = new SensorStates();
		obj.insideTemperature1Coarse = 10 + data[8];
		obj.outsideTemperature = (data[10] - 0x80) * 0.5;
		obj.insideTemperature1Fine = (data[11] - 0x80) * 0.5;
		obj.insideTemperature2 = (data[12] - 0x80) * 0.5;
		obj.runtimeMinutes = data.readUInt32BE(15) & 0xffffff;
		return obj;
	}
}

export class ErrorStates {
	errorCode: number = 0x8000;

	get isAbnormalState(): boolean {
		return this.errorCode !== 0x8000;
	}

	static isErrorStatesPayload(data: Buffer): boolean {
		return data.length >= 6 && (data[1] === 0x62 || data[1] === 0x7b) && data[5] === 0x04;
	}

	static parseErrorStates(data: Buffer): ErrorStates {
		if (data[0] !== 0xfc) {
			throw new Error("Invalid error payload");
		}
		if (data[5] !== 0x04) {
			throw new Error("Not error states");
		}

		const fcc = calcFcc(data.subarray(1, -1));
		if (fcc !== data[data.length - 1]) {
			throw new Error("Invalid checksum");
		}

		const obj = new ErrorStates();
		obj.errorCode = data.readUInt16BE(9);
		return obj;
	}
}

export class EnergyStates {
	operating: boolean = false;
	powerConsumed: number = 0;
	energyConsumed: number = 0;

	static isEnergyStatesPayload(data: Buffer): boolean {
		return data.length >= 6 && (data[1] === 0x62 || data[1] === 0x7b) && data[5] === 0x06;
	}

	static parseEnergyStates(data: Buffer): EnergyStates {
		if (data[0] !== 0xfc) {
			throw new Error("Invalid energy payload");
		}
		if (data[5] !== 0x06) {
			throw new Error("Not energy states");
		}

		const fcc = calcFcc(data.subarray(1, -1));
		if (fcc !== data[data.length - 1]) {
			throw new Error("Invalid checksum");
		}

		const obj = new EnergyStates();
		obj.operating = data[9] !== 0;
		obj.powerConsumed = data.readUInt16BE(10);
		obj.energyConsumed = data.readUInt16BE(12) / 10; // 100 Wh → kWh
		return obj;
	}
}

export class AutoStates {
	powerMode: number = 0;
	autoMode: number = 0; // AutoMode enum equivalent

	static isAutoStatesPayload(data: Buffer): boolean {
		return data.length >= 6 && (data[1] === 0x62 || data[1] === 0x7b) && data[5] === 0x09;
	}

	static parseAutoStates(data: Buffer): AutoStates {
		if (data[0] !== 0xfc) {
			throw new Error("Invalid auto payload");
		}
		if (data[5] !== 0x09) {
			throw new Error("Not auto states");
		}

		const fcc = calcFcc(data.subarray(1, -1));
		if (fcc !== data[data.length - 1]) {
			throw new Error("Invalid checksum");
		}

		const obj = new AutoStates();
		obj.powerMode = data[9];
		obj.autoMode = data[10];
		return obj;
	}
}

export class GeneralStates {
	power: boolean = false;
	operationMode: OperationMode = OperationMode.AUTO;
	coarseTemperature: number = 22;
	targetTemperature: number | null = 22.0;
	fanSpeed: FanSpeed = FanSpeed.AUTO;
	vaneVerticalDirection: VaneVerticalDirection = VaneVerticalDirection.AUTO;
	remoteLock: RemoteLock = RemoteLock.UNLOCKED;
	vaneHorizontalDirection: VaneHorizontalDirection = VaneHorizontalDirection.AUTO;
	dehumidifierLevel: number = 0;
	powerSaving: boolean = false;
	windAndWindBreakDirect: number = 0;
	iSeeSensor: boolean = true;
	wideVaneAdjustment: boolean = false;
	triggerBuzzer: boolean = false;

	constructor(other?: GeneralStates) {
		if (other) {
			Object.assign(this, other);
		}
	}

	static isGeneralStatesPayload(data: Buffer): boolean {
		return data.length >= 6 && (data[1] === 0x62 || data[1] === 0x7b) && data[5] === 0x02;
	}

	static parseGeneralStates(data: Buffer): GeneralStates {
		if (data[0] !== 0xfc) {
			throw new Error("Invalid general payload");
		}
		if (data[5] !== 0x02) {
			throw new Error("Not general states");
		}

		const fcc = calcFcc(data.subarray(1, -1));
		if (fcc !== data[data.length - 1]) {
			throw new Error("Invalid checksum");
		}

		const obj = new GeneralStates();
		obj.power = data[8] === 1;
		obj.operationMode = data[9] & 0x07;
		obj.coarseTemperature = 31 - data[10];
		obj.fanSpeed = data[11];
		obj.vaneVerticalDirection = data[12];
		obj.remoteLock = data[13];
		obj.vaneHorizontalDirection = data[15] & 0x0f;
		obj.wideVaneAdjustment = (data[15] & 0xf0) === 0x80;
		obj.targetTemperature = data[16] !== 0x00 ? (data[16] - 0x80) / 2 : null;
		obj.dehumidifierLevel = data[17];
		obj.powerSaving = data[18] > 0;
		obj.windAndWindBreakDirect = data[19];
		return obj;
	}

	get temperature(): number {
		return this.targetTemperature ?? this.coarseTemperature;
	}

	set temperature(v: number) {
		this.targetTemperature = v;
		this.coarseTemperature = Math.floor(v);
	}

	// generate_general_command -> returns Buffer
	generateGeneralCommand(controls: Controls): Buffer {
		const body = Buffer.alloc(20, 0);
		body[0] = 0x41;
		body[1] = 0x01;
		body[2] = 0x30;
		body[3] = 0x10;
		body[4] = 0x01;
		const ctrl = (controls as unknown as number) | (Controls.OutsideControl as unknown as number);
		body.writeUInt16BE(ctrl & 0xffff, 5);
		body[7] = this.power ? 1 : 0;
		body[8] = typeof this.operationMode === "number" ? this.operationMode : Number(this.operationMode);
		body[9] = 31 - Math.floor(this.temperature);
		body[10] = (this.fanSpeed as unknown as number) & 0xff;
		body[11] = (this.vaneVerticalDirection as unknown as number) & 0xff;
		body[12] = 0;
		body[13] = 0;
		body[14] = 0;
		body[15] = this.remoteLock & 0xff;
		body[16] = 0;
		body[17] = (this.vaneHorizontalDirection as unknown as number) & 0xff;
		body[18] = this.targetTemperature !== null ? (0x80 + Math.floor(this.targetTemperature * 2)) & 0xff : 0x00;
		body[19] = 0x41;

		const fcc = calcFcc(body);
		return Buffer.concat([Buffer.from([0xfc]), body, Buffer.from([fcc])]);
	}

	generateExtend08Command(controls08: Controls08): Buffer {
		const body = Buffer.alloc(20, 0);
		body[0] = 0x41;
		body[1] = 0x01;
		body[2] = 0x30;
		body[3] = 0x10;
		body[4] = 0x08;
		body[5] = (controls08 as unknown as number) & 0xff;
		body[8] = controls08 & Controls08.Dehum ? this.dehumidifierLevel & 0xff : 0;
		body[9] = this.powerSaving ? 0x0a : 0x00;
		body[10] = controls08 & Controls08.WindAndWindBreak ? this.windAndWindBreakDirect & 0xff : 0;
		body[11] = controls08 & Controls08.Buzzer ? 0x01 : 0x00;
		const fcc = calcFcc(body);
		return Buffer.concat([Buffer.from([0xfc]), body, Buffer.from([fcc])]);
	}
}

export class ParsedDeviceState {
	general: GeneralStates;
	sensors: SensorStates | undefined = undefined;
	errors: ErrorStates | undefined = undefined;
	energy: EnergyStates | undefined = undefined;
	autoState: AutoStates | undefined = undefined;
	ip: string = "";
	mac: string = "";
	serial: string = "";
	rssi: string = "";
	appVersion: string = "";

	constructor() {
		this.general = new GeneralStates();
		this.sensors = new SensorStates();
		this.errors = new ErrorStates();
		this.energy = new EnergyStates();
		this.autoState = new AutoStates();
	}

	static parseCodeValues(codeValues: string[]): ParsedDeviceState {
		const parsed = new ParsedDeviceState();

		for (const hexValue of codeValues) {
			if (!hexValue || hexValue.length < 2) {
				continue;
			}

			const data = Buffer.from(hexValue, "hex");

			if (GeneralStates.isGeneralStatesPayload(data)) {
				parsed.general = GeneralStates.parseGeneralStates(data);
			} else if (SensorStates.isSensorStatesPayload(data)) {
				parsed.sensors = SensorStates.parseSensorStates(data);
			} else if (ErrorStates.isErrorStatesPayload(data)) {
				parsed.errors = ErrorStates.parseErrorStates(data);
			} else if (EnergyStates.isEnergyStatesPayload(data)) {
				parsed.energy = EnergyStates.parseEnergyStates(data);
			} else if (AutoStates.isAutoStatesPayload(data)) {
				parsed.autoState = AutoStates.parseAutoStates(data);
			}
		}

		return parsed;
	}
}
