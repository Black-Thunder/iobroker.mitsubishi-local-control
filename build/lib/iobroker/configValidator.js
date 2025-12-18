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
var configValidator_exports = {};
__export(configValidator_exports, {
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(configValidator_exports);
var import_utils = require("./utils");
function validateConfig(adapter) {
  adapter.log.debug("Checking adapter settings...");
  if (!adapter.config.pollingInterval || adapter.config.pollingInterval < 15) {
    adapter.config.pollingInterval = 15;
    adapter.log.warn("Polling interval can't be set lower than 15 seconds. Now set to 15 seconds.");
  }
  const devices = adapter.config.devices;
  if (!devices || !Array.isArray(devices)) {
    adapter.log.error("No valid devices configured. Please add at least one device.");
    return false;
  }
  const cleanedDevices = devices.filter((d) => {
    var _a, _b;
    return ((_a = d == null ? void 0 : d.name) == null ? void 0 : _a.trim()) && ((_b = d == null ? void 0 : d.ip) == null ? void 0 : _b.trim()) && (0, import_utils.isValidIPv4)(d.ip.trim());
  });
  if (cleanedDevices.length !== devices.length) {
    adapter.log.warn("Some device entries were invalid and have been removed.");
  }
  adapter.config.devices = cleanedDevices;
  if (adapter.config.devices.length === 0) {
    adapter.log.error("No valid devices configured. Please add at least one device.");
    return false;
  }
  return true;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validateConfig
});
//# sourceMappingURL=configValidator.js.map
