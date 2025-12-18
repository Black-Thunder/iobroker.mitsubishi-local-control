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
var import_utils = require("./lib/iobroker/utils");
var import_commands = require("./lib/iobroker/commands");
var import_configValidator = require("./lib/iobroker/configValidator");
var import_stateConfig = require("./lib/iobroker/stateConfig");
var import_mitsubishiController = require("./lib/mitsubishi/mitsubishiController");
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
    await (0, import_utils.setAdapterConnectionState)(this, false);
    if (!(0, import_configValidator.validateConfig)(this)) {
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
      await (0, import_utils.setAdapterConnectionState)(this, true);
    } catch (err) {
      this.log.error(`Error while starting polling: ${err}`);
      await (0, import_utils.setAdapterConnectionState)(this, false);
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
        const device = (0, import_utils.getDeviceByMac)(this, mac);
        if (!device) {
          this.log.error(`No device found for MAC ${mac}`);
          return;
        }
        this.log.debug(`Command on ${id} \u2192 forwarding to device ${device.name} (${mac})`);
        try {
          const commandKey = Object.keys(import_commands.COMMAND_MAP).find((k) => id.endsWith(k));
          if (!commandKey) {
            this.log.warn(`Unhandled command for ${id}`);
            return;
          }
          await import_commands.COMMAND_MAP[commandKey](device, state.val);
          await this.setState(id, state.val, true);
        } catch (err) {
          this.log.error(`Error executing command for ${device.name}: ${err}`);
        }
      }
    } else {
      this.log.silly(`state ${id} deleted`);
    }
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
          await this.updateDeviceStates(parsed, device.name);
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
   * Updates iobroker states recursively based on the provided object.
   *
   * @param parentId - The parent ID for the states
   * @param obj - The object containing states to update
   */
  async writeRecursive(parentId, obj) {
    var _a, _b, _c, _d, _e, _f;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
        await this.writeRecursive(parentId, value);
        continue;
      }
      const config = (_c = (_b = (_a = import_stateConfig.STATE_MAP)[key]) == null ? void 0 : _b.call(_a, value)) != null ? _c : (0, import_stateConfig.guessStateConfig)(key, value);
      const id = `${parentId}.${config.write ? "control" : "info"}.${key}`;
      await this.setObjectNotExistsAsync(id, {
        type: "state",
        common: {
          name: (_d = config.name) != null ? _d : key,
          desc: config.desc,
          type: config.type,
          role: config.role,
          unit: config.unit,
          read: (_e = config.read) != null ? _e : true,
          write: (_f = config.write) != null ? _f : false,
          min: config.min,
          max: config.max,
          ...config.states ? { states: config.states } : {}
        },
        native: {}
      });
      if (config.write) {
        this.subscribeStates(id);
      }
      await this.setState(id, { val: value, ack: true });
    }
  }
  async updateDeviceStates(parsedState, deviceName) {
    var _a;
    const deviceId = `devices.${parsedState.mac.replace(/:/g, "")}`;
    await this.setObjectNotExistsAsync(`${deviceId}`, {
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
    await this.setObjectNotExistsAsync(`${deviceId}.control`, {
      type: "channel",
      common: { name: "Device control" },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${deviceId}.control.enableEchonet`, {
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
    await this.setObjectNotExistsAsync(`${deviceId}.control.rebootDevice`, {
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
    await this.setObjectNotExistsAsync(`${deviceId}.info`, {
      type: "channel",
      common: { name: "Device information" },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${deviceId}.info.deviceOnline`, {
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
    await this.setObjectNotExistsAsync(`${deviceId}.info.hasError`, {
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
    await this.writeRecursive(deviceId, parsedState);
    await this.setState(`${deviceId}.info.hasError`, { val: (_a = parsedState.errors) == null ? void 0 : _a.isAbnormalState, ack: true });
  }
}
if (require.main !== module) {
  module.exports = (options) => new MitsubishiLocalControl(options);
} else {
  (() => new MitsubishiLocalControl())();
}
//# sourceMappingURL=main.js.map
