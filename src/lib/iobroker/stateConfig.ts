// -----------------------------
// State Mapping Config

import {
	AutoMode,
	FanSpeed,
	OperationMode,
	RemoteLock,
	VaneHorizontalDirection,
	VaneVerticalDirection,
} from "../mitsubishi/types";
import { enumToStates } from "./utils";

// -----------------------------
interface StateConfig {
	type: ioBroker.CommonType;
	role: string;
	name?: string;
	desc?: string;
	unit?: string;
	read?: boolean;
	write?: boolean;
	min?: number;
	max?: number;
	states?: Record<string, string>;
}

const STATE_MAP: Record<string, (_value: any) => StateConfig> = {
	power: _v => ({
		type: "boolean",
		role: "switch.power",
		name: "Power",
		desc: "Turns the device on or off",
		write: true,
	}),
	powerSaving: _v => ({
		type: "boolean",
		role: "switch",
		name: "Power Saving",
		desc: "Enables or disables power saving mode",
		write: true,
	}),
	targetTemperature: _v => ({
		type: "number",
		role: "level.temperature",
		name: "Target Temperature",
		desc: "Sets the target temperature of the device",
		write: true,
		min: 16,
		max: 31,
		unit: "°C",
	}),
	operationMode: _v => ({
		type: "number",
		role: "level.mode.airconditioner",
		name: "Operation Mode",
		desc: "Sets the operation mode of the device",
		write: true,
		states: enumToStates(OperationMode),
	}),
	fanSpeed: _v => ({
		type: "number",
		role: "level.mode.fan",
		name: "Fan Speed",
		desc: "Sets the fan speed when in manual mode",
		write: true,
		states: enumToStates(FanSpeed),
	}),
	vaneVerticalDirection: _v => ({
		type: "number",
		role: "level",
		name: "Vane Vertical Direction",
		desc: "Sets the vertical direction of the vane",
		write: true,
		states: enumToStates(VaneVerticalDirection),
	}),
	vaneHorizontalDirection: _v => ({
		type: "number",
		role: "level",
		name: "Vane Horizontal Direction",
		desc: "Sets the horizontal direction of the vane",
		write: true,
		states: enumToStates(VaneHorizontalDirection),
	}),
	remoteLock: _v => ({
		type: "number",
		role: "switch.mode",
		name: "Remote Lock",
		desc: "Sets the remote lock state of the device",
		write: true,
		states: enumToStates(RemoteLock),
	}),
	triggerBuzzer: _v => ({
		type: "boolean",
		role: "button",
		name: "Trigger buzzer",
		desc: "Triggers the device buzzer",
		write: true,
		read: false,
	}),
	dehumidifierLevel: _v => ({
		type: "number",
		role: "level.humidity",
		name: "Dehumidifier Level",
		desc: "Sets the dehumidifier level",
		write: true,
		min: 0,
		max: 100,
		unit: "%",
	}),
	autoMode: _v => ({
		type: "number",
		role: "mode",
		name: "Auto Mode",
		desc: "Current auto mode of the device",
		states: enumToStates(AutoMode),
	}),
	errorCode: _v => ({
		type: "number",
		role: "value",
		name: "Error Code",
		desc: "Current error code of the device",
		states: { 32768: "No error" },
	}),
};

// Fallback for unknown states
export function guessStateConfig(key: string, value: any): StateConfig {
	const keyLower = key.toLowerCase();
	const config: StateConfig = { type: "string", role: "text", name: key, read: true };
	config.desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);

	if (typeof value === "boolean") {
		config.type = "boolean";
		config.role = "indicator";
	} else if (typeof value === "number") {
		config.type = "number";
		config.role = "value";

		if (keyLower.includes("temperature")) {
			config.role = "value.temperature";
			config.unit = "°C";
		} else if (keyLower.includes("power") || keyLower.includes("energy")) {
			config.role = "value.power";

			if (keyLower.includes("energy")) {
				config.unit = "kWh";
			}
		}
	} else if (typeof value === "string") {
		config.type = "string";
		config.role = "text";
	}

	return config;
}

export { STATE_MAP };
export type { StateConfig };
