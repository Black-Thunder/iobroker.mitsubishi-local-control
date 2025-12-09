"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_utils = require("./lib/mitsubishi/utils");
var import_mitsubishiController = require("./lib/mitsubishi/mitsubishiController");
var import_types = require("./lib/mitsubishi/types");
class MitsubishiLocalControl extends utils.Adapter {
  devices = [];
  constructor(options = {}) {
    super({
      ...options,
      name: "mitsubishi-local-control"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a;
    await this.setAdapterConnectionState(false);
    if (!this.validateConfig()) {
      this.log.error("Invalid configuration detected. Stopping adapter.");
      return;
    }
    this.log.info(`Configuring ${this.config.devices.length} device(s)...`);
    this.devices = ((_a = this.config.devices) != null ? _a : []).map((c) => ({
      ...c,
      controller: import_mitsubishiController.MitsubishiController.create(c.ip, this.log)
    }));
    try {
      await this.startPolling();
      await this.setAdapterConnectionState(true);
    } catch (err) {
      this.log.error(`Error while starting polling: ${err}`);
      await this.setAdapterConnectionState(false);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback - Callback function
   */
  onUnload(callback) {
    try {
      this.stopPolling();
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
  /**
   * Is called if a subscribed state changes
   *
   * @param id - State ID
   * @param state - State object
   */
  async onStateChange(id, state) {
    if (state) {
      this.log.silly(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
      if (state.ack === false) {
        this.log.debug(`User command received for ${id}: ${state.val}`);
        const mac = (0, import_utils.getMacFromStateId)(id);
        if (!mac) {
          this.log.error(`Unable to extract MAC address from state ID: ${id}`);
          return;
        }
        const device = this.getDeviceByMac(mac);
        if (!device) {
          this.log.error(`No device found for MAC ${mac}`);
          return;
        }
        this.log.debug(`Command on ${id} \u2192 forwarding to device ${device.name} (${mac})`);
        try {
          if (id.endsWith("powerOnOff")) {
            await device.controller.setPower(state.val);
          } else if (id.endsWith("fineTemperature")) {
            await device.controller.setTemperature(state.val);
          } else if (id.endsWith("driveMode")) {
            await device.controller.setMode(state.val);
          } else if (id.endsWith("windSpeed")) {
            await device.controller.setFanSpeed(state.val);
          } else if (id.endsWith("verticalWindDirection")) {
            await device.controller.setVerticalVane(state.val);
          } else if (id.endsWith("horizontalWindDirection")) {
            await device.controller.setHorizontalVane(state.val);
          } else {
            this.log.warn(`Unhandled command for state ${id}`);
            return;
          }
        } catch (err) {
          this.log.error(`Error executing command for ${mac}: ${err}`);
        }
      }
    } else {
      this.log.silly(`state ${id} deleted`);
    }
  }
  validateConfig() {
    this.log.debug("Checking adapter settings...");
    if (!this.config.pollingInterval || this.config.pollingInterval < 15) {
      this.config.pollingInterval = 15;
      this.log.warn("Polling interval can't be set lower than 15 seconds. Now set to 15 seconds.");
    }
    const devices = this.config.devices;
    if (!devices || !Array.isArray(devices)) {
      this.log.error("No valid devices configured. Please add at least one device.");
      return false;
    }
    const cleanedDevices = devices.filter((d) => {
      var _a, _b;
      return ((_a = d == null ? void 0 : d.name) == null ? void 0 : _a.trim()) && ((_b = d == null ? void 0 : d.ip) == null ? void 0 : _b.trim()) && this.isValidIPv4(d.ip.trim());
    });
    if (cleanedDevices.length !== devices.length) {
      this.log.warn("Some device entries were invalid and have been removed.");
    }
    this.config.devices = cleanedDevices;
    if (this.config.devices.length === 0) {
      this.log.error("No valid devices configured. Please add at least one device.");
      return false;
    }
    return true;
  }
  isValidIPv4(ip) {
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
  async setAdapterConnectionState(isConnected) {
    await this.setStateChangedAsync("info.connection", isConnected, true);
    this.setForeignState(`system.adapter.${this.namespace}.connected`, isConnected, true);
  }
  getDeviceByMac(mac) {
    const noColMac = String(mac).toLowerCase().replace(/[^0-9a-f]/g, "");
    if (noColMac.length !== 12) {
      return void 0;
    }
    const colMac = noColMac.match(/.{1,2}/g).join(":");
    return this.devices.find((c) => {
      var _a;
      return ((_a = c.controller.parsedDeviceState) == null ? void 0 : _a.mac) === colMac;
    });
  }
  async startPolling() {
    const interval = this.config.pollingInterval * 1e3;
    for (const device of this.devices) {
      const poll = async () => {
        try {
          this.log.debug(`Polling ${device.name} (${device.ip}) ...`);
          const parsed = await device.controller.fetchStatus();
          await this.updateDeviceStates(this, parsed, device.name);
        } catch (err) {
          this.log.error(`Polling error for ${device.name}: ${err}`);
        } finally {
          device.pollingJob = setTimeout(poll, interval);
        }
      };
      await poll();
    }
    this.log.info(`Started polling all devices every ${this.config.pollingInterval} seconds.`);
  }
  stopPolling() {
    this.devices.forEach((c) => {
      if (c.pollingJob) {
        clearTimeout(c.pollingJob);
        this.log.debug(`Cleared polling timer for device ${c.name}.`);
      }
      c.controller.cleanupController();
    });
  }
  enumToStates(enumObj) {
    var _a;
    const res = {};
    for (const key of Object.keys(enumObj)) {
      const v = enumObj[key];
      if (typeof v === "number") {
        res[v] = (_a = this.enumName(enumObj, v)) != null ? _a : key;
      }
    }
    return res;
  }
  isEnumValue(enumObj, value) {
    return Object.values(enumObj).includes(value);
  }
  enumName(enumObj, value) {
    var _a;
    return (_a = enumObj[value]) != null ? _a : value.toString();
  }
  /**
   * Aktualisiert die ioBroker-Objekte für ein ParsedDeviceState
   */
  async writeRecursive(adapter, parentId, obj) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const id = `${parentId}.${key}`;
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        await adapter.setObjectNotExistsAsync(id, {
          type: "channel",
          common: { name: key },
          native: {}
        });
        await this.writeRecursive(adapter, id, value);
        continue;
      }
      let type = "string";
      let role = "state";
      let unit = void 0;
      let states;
      let write = false;
      switch (key) {
        case "powerOnOff":
          if (this.isEnumValue(import_types.PowerOnOff, value)) {
            type = "number";
            states = this.enumToStates(import_types.PowerOnOff);
            role = "switch.power";
            write = true;
          }
          break;
        case "driveMode":
          if (this.isEnumValue(import_types.DriveMode, value)) {
            type = "number";
            states = this.enumToStates(import_types.DriveMode);
            role = "mode";
            write = true;
          }
          break;
        case "windSpeed":
          if (this.isEnumValue(import_types.WindSpeed, value)) {
            type = "number";
            states = this.enumToStates(import_types.WindSpeed);
            role = "level";
            write = true;
          }
          break;
        case "verticalWindDirection":
          if (this.isEnumValue(import_types.VerticalWindDirection, value)) {
            type = "number";
            states = this.enumToStates(import_types.VerticalWindDirection);
            role = "level";
            write = true;
          }
          break;
        case "horizontalWindDirection":
          if (this.isEnumValue(import_types.HorizontalWindDirection, value)) {
            type = "number";
            states = this.enumToStates(import_types.HorizontalWindDirection);
            role = "level";
            write = true;
          }
          break;
        case "autoMode":
          if (this.isEnumValue(import_types.AutoMode, value)) {
            type = "number";
            states = this.enumToStates(import_types.AutoMode);
            role = "mode";
          }
          break;
        case "remoteLock":
          if (this.isEnumValue(import_types.RemoteLock, value)) {
            type = "number";
            states = this.enumToStates(import_types.RemoteLock);
            role = "state";
          }
          break;
        default:
          if (typeof value === "number") {
            const keyLower = key.toLowerCase();
            type = "number";
            if (keyLower.includes("temperature")) {
              role = "value.temperature";
              unit = "\xB0C";
              if (keyLower.includes("finetemperature")) {
                write = true;
              }
            } else if (keyLower.includes("power") || keyLower.includes("energy")) {
              role = "value.power";
              if (keyLower.includes("energy")) {
                unit = "kWh";
              }
            } else {
              role = "value";
            }
          } else if (typeof value === "boolean") {
            type = "boolean";
            role = "indicator";
          }
      }
      await adapter.setObjectNotExistsAsync(id, {
        type: "state",
        common: {
          name: key,
          type,
          role,
          unit,
          read: true,
          write,
          ...states ? { states } : {}
        },
        native: {}
      });
      if (write) {
        this.subscribeStates(id);
      }
      await adapter.setState(id, { val: value, ack: true });
    }
  }
  async updateDeviceStates(adapter, parsedState, deviceName) {
    const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;
    await adapter.setObjectNotExistsAsync(`${deviceId}`, {
      type: "channel",
      common: { name: `${deviceName}` },
      native: {}
    });
    await this.writeRecursive(adapter, `${deviceId}`, parsedState);
  }
}
if (require.main !== module) {
  module.exports = (options) => new MitsubishiLocalControl(options);
} else {
  (() => new MitsubishiLocalControl())();
}
//# sourceMappingURL=main.js.map
