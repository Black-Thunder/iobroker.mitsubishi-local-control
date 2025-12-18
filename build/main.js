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
      controller: import_mitsubishiController.MitsubishiController.create(c.ip, this.log),
      mac: void 0
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
          if (id.endsWith("power")) {
            await device.controller.setPower(state.val);
          } else if (id.endsWith("powerSaving")) {
            await device.controller.setPowerSaving(state.val);
          } else if (id.endsWith("targetTemperature")) {
            await device.controller.setTemperature(state.val);
          } else if (id.endsWith("operationMode")) {
            await device.controller.setMode(state.val);
          } else if (id.endsWith("fanSpeed")) {
            await device.controller.setFanSpeed(state.val);
          } else if (id.endsWith("vaneVerticalDirection")) {
            await device.controller.setVerticalVane(state.val);
          } else if (id.endsWith("vaneHorizontalDirection")) {
            await device.controller.setHorizontalVane(state.val);
          } else if (id.endsWith("remoteLock")) {
            await device.controller.setRemoteLock(state.val);
          } else if (id.endsWith("dehumidifierLevel")) {
            await device.controller.setDehumidifier(state.val);
          } else if (id.endsWith("triggerBuzzer")) {
            await device.controller.triggerBuzzer();
          } else {
            this.log.warn(`Unhandled command for state ${id}`);
            return;
          }
        } catch (err) {
          this.log.error(`Error executing command for ${device.name}: ${err}`);
        }
        await this.setState(id, state.val, true);
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
      return ((_a = d == null ? void 0 : d.name) == null ? void 0 : _a.trim()) && ((_b = d == null ? void 0 : d.ip) == null ? void 0 : _b.trim()) && (0, import_utils.isValidIPv4)(d.ip.trim());
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
        if (device.controller.isCommandInProgress) {
          this.log.debug(`Skipping poll for ${device.name}: command in progress`);
          return;
        }
        try {
          this.log.debug(`Polling ${device.name} (${device.ip}) ...`);
          const parsed = await device.controller.fetchStatus();
          device.mac = parsed.mac;
          await this.updateDeviceStates(this, parsed, device.name);
          await this.setDeviceOnlineState(device.mac, true);
        } catch (err) {
          this.log.error(`Polling error for ${device.name}: ${err}`);
          await this.setDeviceOnlineState(device.mac, false);
        }
      };
      await poll();
      device.pollingJob = setInterval(poll, interval);
    }
    this.log.info(`Started polling all devices every ${this.config.pollingInterval} seconds.`);
  }
  stopPolling() {
    this.devices.forEach((c) => {
      if (c.pollingJob) {
        clearInterval(c.pollingJob);
        this.log.debug(`Cleared polling timer for device ${c.name}.`);
      }
      c.controller.cleanupController();
    });
  }
  async setDeviceOnlineState(mac, isOnline) {
    if (mac) {
      await this.setState(`${this.namespace}.devices.${mac.replace(/:/g, "")}.info.deviceOnline`, {
        val: isOnline,
        ack: true
      });
    }
  }
  /**
   * Aktualisiert die ioBroker-Objekte für ein ParsedDeviceState
   */
  async writeRecursive(adapter, parentId, obj) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        await this.writeRecursive(adapter, parentId, value);
        continue;
      }
      let type = "string";
      let name = key;
      let desc = void 0;
      let role = "state";
      let unit = void 0;
      let states;
      let read = true;
      let write = false;
      let min = void 0;
      let max = void 0;
      switch (key) {
        case "operationMode":
          if ((0, import_utils.isEnumValue)(import_types.OperationMode, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.OperationMode);
            role = "level.mode.airconditioner";
            name = "Operation Mode";
            desc = "Sets the operation mode of the device";
            write = true;
          }
          break;
        case "fanSpeed":
          if ((0, import_utils.isEnumValue)(import_types.FanSpeed, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.FanSpeed);
            role = "level.mode.fan";
            name = "Fan speed";
            desc = "Sets the fan speed when in manual mode";
            write = true;
          }
          break;
        case "vaneVerticalDirection":
          if ((0, import_utils.isEnumValue)(import_types.VaneVerticalDirection, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.VaneVerticalDirection);
            role = "level";
            name = "Vane vertical direction";
            desc = "Sets the vertical direction of the vane";
            write = true;
          }
          break;
        case "vaneHorizontalDirection":
          if ((0, import_utils.isEnumValue)(import_types.VaneHorizontalDirection, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.VaneHorizontalDirection);
            role = "level";
            name = "Vane horizontal direction";
            desc = "Sets the horizontal direction of the vane";
            write = true;
          }
          break;
        case "autoMode":
          if ((0, import_utils.isEnumValue)(import_types.AutoMode, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.AutoMode);
            role = "mode";
            name = "Auto mode";
            desc = "Current auto mode of the device";
          }
          break;
        case "remoteLock":
          if ((0, import_utils.isEnumValue)(import_types.RemoteLock, value)) {
            type = "number";
            states = (0, import_utils.enumToStates)(import_types.RemoteLock);
            write = true;
            name = "Remote lock";
            desc = "Sets the remote lock state of the device";
          }
          break;
        // Map other types
        default:
          if (typeof value === "number") {
            const keyLower = key.toLowerCase();
            type = "number";
            desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);
            if (keyLower.includes("temperature")) {
              role = "value.temperature";
              unit = "\xB0C";
              if (keyLower.includes("targettemperature")) {
                write = true;
                role = "level.temperature";
                name = "Target temperature";
                desc = "Sets the target temperature of the device";
                min = 16;
                max = 31;
                unit = "\xB0C";
              }
            } else if (keyLower.includes("dehumidifierlevel")) {
              write = true;
              name = "Dehumidifier level";
              desc = "Sets the dehumidifier level";
              unit = "%";
              min = 0;
              max = 100;
              role = "level.humidity";
            } else if (keyLower.includes("power") || keyLower.includes("energy")) {
              role = "value.power";
              if (keyLower.includes("energy")) {
                unit = "kWh";
              }
            } else if (keyLower.includes("errorcode")) {
              states = { 32768: "No error" };
              role = "value";
            } else {
              role = "value";
            }
          } else if (typeof value === "boolean") {
            const keyLower = key.toLowerCase();
            type = "boolean";
            if (keyLower.includes("triggerbuzzer")) {
              role = "button";
              name = "Trigger buzzer";
              desc = "Triggers the device buzzer";
              read = false;
              write = true;
            } else if (keyLower === "power") {
              role = "switch.power";
              name = "Power";
              desc = "Turns the device on or off";
              write = true;
            } else if (keyLower === "powersaving") {
              role = "switch";
              name = "Power saving";
              desc = "Enables or disables power saving mode";
              write = true;
            } else {
              role = "indicator";
            }
          } else if (typeof value === "string") {
            type = "string";
            role = "text";
            desc = String(key).charAt(0).toUpperCase() + String(key).slice(1);
          }
      }
      const id = write ? `${parentId}.control.${key}` : `${parentId}.info.${key}`;
      await adapter.setObjectNotExistsAsync(id, {
        type: "state",
        common: {
          name,
          desc,
          type,
          role,
          unit,
          read,
          write,
          min,
          max,
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
    var _a;
    const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;
    await adapter.setObjectNotExistsAsync(`${deviceId}`, {
      type: "device",
      common: {
        statusStates: {
          onlineId: `${this.namespace}.${deviceId}.info.deviceOnline`,
          errorId: `${this.namespace}.${deviceId}.info.hasError`
        },
        name: `${deviceName}`
      },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.control`, {
      type: "channel",
      common: { name: "Device control" },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.control.enableEchonet`, {
      type: "state",
      common: {
        name: "Enable ECHONET",
        type: "boolean",
        role: "button",
        read: false,
        write: true,
        desc: "Send enable ECHONET command",
        def: false
      },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.control.rebootDevice`, {
      type: "state",
      common: {
        name: "Reboot device",
        type: "boolean",
        role: "button",
        read: false,
        write: true,
        desc: "Send reboot device command",
        def: false
      },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.info`, {
      type: "channel",
      common: { name: "Device information" },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.info.deviceOnline`, {
      type: "state",
      common: {
        name: "Is device online",
        type: "boolean",
        role: "indicator.reachable",
        read: true,
        write: false,
        desc: "Indicates if device is reachable",
        def: false
      },
      native: {}
    });
    await adapter.setObjectNotExistsAsync(`${deviceId}.info.hasError`, {
      type: "state",
      common: {
        name: "Has device an error",
        type: "boolean",
        role: "indicator.error",
        read: true,
        write: false,
        desc: "Indicates if device has an error",
        def: false
      },
      native: {}
    });
    await this.writeRecursive(adapter, deviceId, parsedState);
    await adapter.setState(`${deviceId}.info.hasError`, { val: (_a = parsedState.errors) == null ? void 0 : _a.isAbnormalState, ack: true });
  }
}
if (require.main !== module) {
  module.exports = (options) => new MitsubishiLocalControl(options);
} else {
  (() => new MitsubishiLocalControl())();
}
//# sourceMappingURL=main.js.map
