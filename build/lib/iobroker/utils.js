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
var utils_exports = {};
__export(utils_exports, {
  enumName: () => enumName,
  enumToStates: () => enumToStates,
  getDeviceByMac: () => getDeviceByMac,
  getMacFromStateId: () => getMacFromStateId,
  isEnumValue: () => isEnumValue,
  isValidIPv4: () => isValidIPv4,
  setAdapterConnectionState: () => setAdapterConnectionState
});
module.exports = __toCommonJS(utils_exports);
function getMacFromStateId(id) {
  const parts = id.split(".");
  const idx = parts.indexOf("devices");
  if (idx >= 0 && parts.length > idx + 1) {
    return parts[idx + 1];
  }
  return null;
}
function isValidIPv4(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const num = Number(part);
    if (num < 0 || num > 255) {
      return false;
    }
  }
  return true;
}
function enumToStates(enumObj) {
  var _a;
  const res = {};
  for (const key of Object.keys(enumObj)) {
    const v = enumObj[key];
    if (typeof v === "number") {
      res[v] = (_a = enumName(enumObj, v)) != null ? _a : key;
    }
  }
  return res;
}
function isEnumValue(enumObj, value) {
  return Object.values(enumObj).includes(value);
}
function enumName(enumObj, value) {
  var _a;
  return (_a = enumObj[value]) != null ? _a : value.toString();
}
function getDeviceByMac(adapter, mac) {
  const noColMac = String(mac).toLowerCase().replace(/[^0-9a-f]/g, "");
  if (noColMac.length !== 12) {
    return void 0;
  }
  const colMac = noColMac.match(/.{1,2}/g).join(":");
  return adapter.devices.find((c) => {
    var _a;
    return ((_a = c.controller.parsedDeviceState) == null ? void 0 : _a.mac) === colMac;
  });
}
async function setAdapterConnectionState(adapter, isConnected) {
  await adapter.setStateChangedAsync("info.connection", isConnected, true);
  adapter.setForeignState(`system.adapter.${adapter.namespace}.connected`, isConnected, true);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  enumName,
  enumToStates,
  getDeviceByMac,
  getMacFromStateId,
  isEnumValue,
  isValidIPv4,
  setAdapterConnectionState
});
//# sourceMappingURL=utils.js.map
