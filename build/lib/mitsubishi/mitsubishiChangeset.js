"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mitsubishiChangeset_exports = {};
__export(mitsubishiChangeset_exports, {
  MitsubishiChangeSet: () => MitsubishiChangeSet
});
module.exports = __toCommonJS(mitsubishiChangeset_exports);
var import_types = require("./types");
class MitsubishiChangeSet {
  desiredState;
  changes;
  changes08;
  constructor(currentState) {
    this.desiredState = new import_types.GeneralStates(currentState);
    this.changes = import_types.Controls.NoControl;
    this.changes08 = import_types.Controls08.NoControl;
  }
  get empty() {
    return this.changes === import_types.Controls.NoControl && this.changes08 === import_types.Controls08.NoControl;
  }
  setPower(power) {
    this.desiredState.power = power;
    this.changes |= import_types.Controls.Power;
  }
  setOperationMode(operationMode) {
    if (operationMode === import_types.OperationMode.AUTO) {
      this.desiredState.operationMode = 8;
    } else {
      this.desiredState.operationMode = operationMode;
    }
    this.changes |= import_types.Controls.OperationMode;
  }
  setTemperature(temperature) {
    this.desiredState.temperature = temperature;
    this.changes |= import_types.Controls.Temperature;
  }
  setDehumidifier(humidity) {
    this.desiredState.dehumidifierLevel = humidity;
    this.changes08 |= import_types.Controls08.Dehum;
  }
  setFanSpeed(fanSpeed) {
    this.desiredState.fanSpeed = fanSpeed;
    this.changes |= import_types.Controls.FanSpeed;
  }
  setVerticalVane(vVane) {
    this.desiredState.vaneVerticalDirection = vVane;
    this.changes |= import_types.Controls.VaneVerticalDirection;
  }
  setHorizontalVane(hVane) {
    this.desiredState.vaneHorizontalDirection = hVane;
    this.changes |= import_types.Controls.VaneHorizontalDirection;
  }
  setPowerSaving(powerSaving) {
    this.desiredState.powerSaving = powerSaving;
    this.changes08 |= import_types.Controls08.PowerSaving;
  }
  setRemoteLock(remoteLock) {
    this.desiredState.remoteLock = remoteLock;
    this.changes |= import_types.Controls.RemoteLock;
  }
  triggerBuzzer() {
    this.desiredState.triggerBuzzer = true;
    this.changes08 |= import_types.Controls08.Buzzer;
  }
  merge(other) {
    if (other.changes & import_types.Controls.Power) {
      this.desiredState.power = other.desiredState.power;
    }
    if (other.changes & import_types.Controls.OperationMode) {
      this.desiredState.operationMode = other.desiredState.operationMode;
    }
    if (other.changes & import_types.Controls.Temperature) {
      this.desiredState.temperature = other.desiredState.temperature;
    }
    if (other.changes & import_types.Controls.FanSpeed) {
      this.desiredState.fanSpeed = other.desiredState.fanSpeed;
    }
    if (other.changes & import_types.Controls.VaneVerticalDirection) {
      this.desiredState.vaneVerticalDirection = other.desiredState.vaneVerticalDirection;
    }
    if (other.changes & import_types.Controls.VaneHorizontalDirection) {
      this.desiredState.vaneHorizontalDirection = other.desiredState.vaneHorizontalDirection;
    }
    if (other.changes & import_types.Controls.RemoteLock) {
      this.desiredState.remoteLock = other.desiredState.remoteLock;
    }
    if (other.changes08 & import_types.Controls08.Dehum) {
      this.desiredState.dehumidifierLevel = other.desiredState.dehumidifierLevel;
    }
    if (other.changes08 & import_types.Controls08.PowerSaving) {
      this.desiredState.powerSaving = other.desiredState.powerSaving;
    }
    if (other.changes08 & import_types.Controls08.Buzzer) {
      this.desiredState.triggerBuzzer = true;
    }
    this.changes |= other.changes;
    this.changes08 |= other.changes08;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MitsubishiChangeSet
});
//# sourceMappingURL=mitsubishiChangeset.js.map
