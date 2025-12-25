import type { FanSpeed, RemoteLock, VaneHorizontalDirection, VaneVerticalDirection } from "./types";
import { Controls, Controls08, GeneralStates, OperationMode } from "./types";

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

	setOperationMode(operationMode: OperationMode): void {
		if (operationMode === OperationMode.AUTO) {
			this.desiredState.operationMode = 8 as number;
		} else {
			this.desiredState.operationMode = operationMode as number;
		}

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

	merge(other: MitsubishiChangeSet): void {
		// --- General Controls ---
		if (other.changes & Controls.Power) {
			this.desiredState.power = other.desiredState.power;
		}

		if (other.changes & Controls.OperationMode) {
			this.desiredState.operationMode = other.desiredState.operationMode;
		}

		if (other.changes & Controls.Temperature) {
			this.desiredState.temperature = other.desiredState.temperature;
		}

		if (other.changes & Controls.FanSpeed) {
			this.desiredState.fanSpeed = other.desiredState.fanSpeed;
		}

		if (other.changes & Controls.VaneVerticalDirection) {
			this.desiredState.vaneVerticalDirection = other.desiredState.vaneVerticalDirection;
		}

		if (other.changes & Controls.VaneHorizontalDirection) {
			this.desiredState.vaneHorizontalDirection = other.desiredState.vaneHorizontalDirection;
		}

		if (other.changes & Controls.RemoteLock) {
			this.desiredState.remoteLock = other.desiredState.remoteLock;
		}

		// --- Extend 0x08 Controls ---
		if (other.changes08 & Controls08.Dehum) {
			this.desiredState.dehumidifierLevel = other.desiredState.dehumidifierLevel;
		}

		if (other.changes08 & Controls08.PowerSaving) {
			this.desiredState.powerSaving = other.desiredState.powerSaving;
		}

		if (other.changes08 & Controls08.Buzzer) {
			this.desiredState.triggerBuzzer = true;
		}

		// --- Merge flags ---
		this.changes |= other.changes;
		this.changes08 |= other.changes08;
	}
}
