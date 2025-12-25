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
var commands_exports = {};
__export(commands_exports, {
  COMMAND_MAP: () => COMMAND_MAP
});
module.exports = __toCommonJS(commands_exports);
const COMMAND_MAP = {
  power: (d, v) => d.controller.setPower(v),
  powerSaving: (d, v) => d.controller.setPowerSaving(v),
  targetTemperature: (d, v) => d.controller.setTemperature(v),
  operationMode: (d, v) => d.controller.setOperationMode(v),
  fanSpeed: (d, v) => d.controller.setFanSpeed(v),
  vaneVerticalDirection: (d, v) => d.controller.setVerticalVane(v),
  vaneHorizontalDirection: (d, v) => d.controller.setHorizontalVane(v),
  remoteLock: (d, v) => d.controller.setRemoteLock(v),
  dehumidifierLevel: (d, v) => d.controller.setDehumidifier(v),
  triggerBuzzer: (d) => d.controller.triggerBuzzer()
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COMMAND_MAP
});
//# sourceMappingURL=commands.js.map
