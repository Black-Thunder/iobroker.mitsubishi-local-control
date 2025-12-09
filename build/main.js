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
  clients = [];
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
    this.log.debug(`Configured Polling Interval: ${this.config.pollingInterval} seconds`);
    this.clients = ((_a = this.config.clients) != null ? _a : []).map((c) => ({
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
        const client = this.getClientByMac(mac);
        if (!client) {
          this.log.error(`No client found for MAC ${mac}`);
          return;
        }
        this.log.debug(`Command on ${id} \u2192 forwarding to client ${client.name} (${mac})`);
        try {
          if (id.endsWith("powerOnOff")) {
            await client.controller.setPower(state.val);
          }
        } catch (err) {
          this.log.error(`Error executing command for ${mac}: ${err}`);
        }
      }
    } else {
      this.log.silly(`state ${id} deleted`);
    }
  }
  async setAdapterConnectionState(isConnected) {
    await this.setStateChangedAsync("info.connection", isConnected, true);
    this.setForeignState(`system.adapter.${this.namespace}.connected`, isConnected, true);
  }
  getClientByMac(mac) {
    const noColMac = String(mac).toLowerCase().replace(/[^0-9a-f]/g, "");
    if (noColMac.length !== 12) {
      return void 0;
    }
    const colMac = noColMac.match(/.{1,2}/g).join(":");
    return this.clients.find((c) => {
      var _a;
      return ((_a = c.controller.parsedDeviceState) == null ? void 0 : _a.mac) === colMac;
    });
  }
  async startPolling() {
    const interval = this.config.pollingInterval * 1e3;
    for (const client of this.clients) {
      const poll = async () => {
        try {
          this.log.debug(`Polling ${client.name} (${client.ip}) ...`);
          const parsed = await client.controller.fetchStatus();
          await this.updateDeviceStates(this, parsed, client.name);
        } catch (err) {
          this.log.error(`Polling error for ${client.name}: ${err}`);
        } finally {
          client.pollingJob = setTimeout(poll, interval);
        }
      };
      await poll();
      this.log.debug(`Started polling timer for device ${client.name}.`);
    }
  }
  stopPolling() {
    this.clients.forEach((c) => {
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
              if (keyLower == "fineTemperature") {
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
  async updateDeviceStates(adapter, parsedState, clientName) {
    const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;
    await adapter.setObjectNotExistsAsync(`${deviceId}`, {
      type: "channel",
      common: { name: `${clientName}` },
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
