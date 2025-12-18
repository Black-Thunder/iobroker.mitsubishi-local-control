import { Device } from "../mitsubishi/device";
import { ParsedDeviceState } from "../mitsubishi/types";

type CommandHandler = (_device: Device, _value: any) => Promise<ParsedDeviceState | undefined>;

const COMMAND_MAP: Record<string, CommandHandler> = {
	power: (d, v) => d.controller.setPower(v as boolean),
	powerSaving: (d, v) => d.controller.setPowerSaving(v as boolean),
	targetTemperature: (d, v) => d.controller.setTemperature(v as number),
	operationMode: (d, v) => d.controller.setMode(v as number),
	fanSpeed: (d, v) => d.controller.setFanSpeed(v as number),
	vaneVerticalDirection: (d, v) => d.controller.setVerticalVane(v as number),
	vaneHorizontalDirection: (d, v) => d.controller.setHorizontalVane(v as number),
	remoteLock: (d, v) => d.controller.setRemoteLock(v as number),
	dehumidifierLevel: (d, v) => d.controller.setDehumidifier(v as number),
	triggerBuzzer: d => d.controller.triggerBuzzer(),
};

export { COMMAND_MAP };
