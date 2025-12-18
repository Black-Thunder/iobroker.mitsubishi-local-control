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
var stateConfig_exports = {};
__export(stateConfig_exports, {
  STATE_MAP: () => STATE_MAP,
  guessStateConfig: () => guessStateConfig
});
module.exports = __toCommonJS(stateConfig_exports);
var import_types = require("../mitsubishi/types");
var import_utils = require("./utils");
const STATE_MAP = {
  power: (_v) => ({
    type: "boolean",
    role: "switch.power",
    name: "Power",
    desc: "Turns the device on or off",
    write: true
  }),
  powerSaving: (_v) => ({
    type: "boolean",
    role: "switch",
    name: "Power Saving",
    desc: "Enables or disables power saving mode",
    write: true
  }),
  targetTemperature: (_v) => ({
    type: "number",
    role: "level.temperature",
    name: "Target Temperature",
    desc: "Sets the target temperature of the device",
    write: true,
    min: 16,
    max: 31,
    unit: "\xB0C"
  }),
  operationMode: (_v) => ({
    type: "number",
    role: "level.mode.airconditioner",
    name: "Operation Mode",
    desc: "Sets the operation mode of the device",
    write: true,
    states: (0, import_utils.enumToStates)(import_types.OperationMode)
  }),
  fanSpeed: (_v) => ({
    type: "number",
    role: "level.mode.fan",
    name: "Fan Speed",
    desc: "Sets the fan speed when in manual mode",
    write: true,
    states: (0, import_utils.enumToStates)(import_types.FanSpeed)
  }),
  vaneVerticalDirection: (_v) => ({
    type: "number",
    role: "level",
    name: "Vane Vertical Direction",
    desc: "Sets the vertical direction of the vane",
    write: true,
    states: (0, import_utils.enumToStates)(import_types.VaneVerticalDirection)
  }),
  vaneHorizontalDirection: (_v) => ({
    type: "number",
    role: "level",
    name: "Vane Horizontal Direction",
    desc: "Sets the horizontal direction of the vane",
    write: true,
    states: (0, import_utils.enumToStates)(import_types.VaneHorizontalDirection)
  }),
  remoteLock: (_v) => ({
    type: "number",
    role: "switch.mode",
    name: "Remote Lock",
    desc: "Sets the remote lock state of the device",
    write: true,
    states: (0, import_utils.enumToStates)(import_types.RemoteLock)
  }),
  triggerBuzzer: (_v) => ({
    type: "boolean",
    role: "button",
    name: "Trigger buzzer",
    desc: "Triggers the device buzzer",
    write: true,
    read: false
  }),
  dehumidifierLevel: (_v) => ({
    type: "number",
    role: "level.humidity",
    name: "Dehumidifier Level",
    desc: "Sets the dehumidifier level",
    write: true,
    min: 0,
    max: 100,
    unit: "%"
  }),
  autoMode: (_v) => ({
    type: "number",
    role: "mode",
    name: "Auto Mode",
    desc: "Current auto mode of the device",
    states: (0, import_utils.enumToStates)(import_types.AutoMode)
  }),
  errorCode: (_v) => ({
    type: "number",
    role: "value",
    name: "Error Code",
    desc: "Current error code of the device",
    states: { 32768: "No error" }
  })
};
function guessStateConfig(key, value) {
  const keyLower = key.toLowerCase();
  const config = { type: "string", role: "text", name: key, read: true };
  config.desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);
  if (typeof value === "boolean") {
    config.type = "boolean";
    config.role = "indicator";
  } else if (typeof value === "number") {
    config.type = "number";
    config.role = "value";
    if (keyLower.includes("temperature")) {
      config.role = "value.temperature";
      config.unit = "\xB0C";
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  STATE_MAP,
  guessStateConfig
});
//# sourceMappingURL=stateConfig.js.map
