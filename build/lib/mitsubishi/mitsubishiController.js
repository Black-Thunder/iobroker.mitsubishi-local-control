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
var mitsubishiController_exports = {};
__export(mitsubishiController_exports, {
  MitsubishiController: () => MitsubishiController
});
module.exports = __toCommonJS(mitsubishiController_exports);
var import_async_mutex = require("async-mutex");
var import_buffer = require("buffer");
var import_fast_xml_parser = require("fast-xml-parser");
var import_mitsubishiApi = require("./mitsubishiApi");
var import_mitsubishiChangeset = require("./mitsubishiChangeset");
var import_types = require("./types");
const xmlParser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  trimValues: true
});
class MitsubishiController {
  parsedDeviceState = null;
  isCommandInProgress = false;
  log;
  api;
  mutex = new import_async_mutex.Mutex();
  commandQueue = [];
  isProcessingQueue = false;
  profileCode = [];
  pendingChangeset = null;
  pendingTimer = null;
  coalesceDelayMs = 200;
  static waitTimeAfterCommand = 6e3;
  constructor(api, log) {
    this.api = api;
    this.log = log;
  }
  static create(deviceHostPort, log, encryptionKey) {
    const api = new import_mitsubishiApi.MitsubishiAPI(deviceHostPort, log, encryptionKey);
    return new MitsubishiController(api, log);
  }
  cleanupController() {
    this.api.close();
  }
  async fetchStatus(useLock = true) {
    if (useLock) {
      return this.withLock(async () => {
        const resp2 = await this.api.sendStatusRequest();
        const parsedResp2 = this.parseStatusResponse(resp2);
        return parsedResp2;
      });
    }
    const resp = await this.api.sendStatusRequest();
    const parsedResp = this.parseStatusResponse(resp);
    return parsedResp;
  }
  parseStatusResponse(xml) {
    const parsed = xmlParser.parse(xml);
    const rootObj = parsed.CSV || parsed.LSV || parsed.ESV || parsed;
    const codeValues = [];
    function collectCodeValues(node) {
      var _a;
      if (!node || typeof node !== "object") {
        return;
      }
      if ((_a = node.CODE) == null ? void 0 : _a.VALUE) {
        const v = node.CODE.VALUE;
        if (Array.isArray(v)) {
          v.forEach((entry) => entry && codeValues.push(entry));
        } else if (typeof v === "string") {
          codeValues.push(v);
        }
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (typeof value === "object") {
          collectCodeValues(value);
        }
      }
    }
    collectCodeValues(rootObj);
    this.parsedDeviceState = import_types.ParsedDeviceState.parseCodeValues(codeValues);
    const mac = this.extractTag(rootObj, "MAC");
    if (mac) {
      this.parsedDeviceState.mac = mac;
    }
    const serial = this.extractTag(rootObj, "SERIAL");
    if (serial) {
      this.parsedDeviceState.serial = serial;
    }
    const rssi = this.extractTag(rootObj, "RSSI");
    if (rssi) {
      this.parsedDeviceState.rssi = rssi.toString();
    }
    const appVer = this.extractTag(rootObj, "APP_VER");
    if (appVer) {
      this.parsedDeviceState.appVersion = appVer.toString();
    }
    this.profileCode = [];
    const profiles1 = this.extractTagList(rootObj, ["PROFILECODE", "DATA", "VALUE"]);
    const profiles2 = this.extractTagList(rootObj, ["PROFILECODE", "VALUE"]);
    const mergedProfiles = [...profiles1, ...profiles2];
    for (const hex of mergedProfiles) {
      try {
        this.profileCode.push(import_buffer.Buffer.from(hex, "hex"));
      } catch {
      }
    }
    this.parsedDeviceState.ip = this.api.getDeviceHostPort();
    return this.parsedDeviceState;
  }
  /**
   * Helper: find a single tag with direct text content
   */
  extractTag(obj, tag) {
    if (!obj || typeof obj !== "object") {
      return null;
    }
    if (obj[tag] && (typeof obj[tag] === "string" || typeof obj[tag] === "number")) {
      return obj[tag].toString();
    }
    for (const key of Object.keys(obj)) {
      const res = this.extractTag(obj[key], tag);
      if (res) {
        return res;
      }
    }
    return null;
  }
  /**
   * Helper: find nested tag list path e.g. ["PROFILECODE","DATA","VALUE"]
   */
  extractTagList(obj, path) {
    const result = [];
    function recursive(node, pathIndex) {
      if (!node || typeof node !== "object") {
        return;
      }
      if (pathIndex === path.length) {
        if (typeof node === "string") {
          result.push(node);
        } else if (Array.isArray(node)) {
          node.forEach((v) => typeof v === "string" && result.push(v));
        }
        return;
      }
      const key = path[pathIndex];
      if (node[key] !== void 0) {
        recursive(node[key], pathIndex + 1);
      }
      for (const k of Object.keys(node)) {
        recursive(node[k], pathIndex);
      }
    }
    recursive(obj, 0);
    return result;
  }
  async applyHexCommand(hex) {
    return this.withLock(async () => {
      try {
        this.isCommandInProgress = true;
        await this.api.sendHexCommand(hex);
        await new Promise((r) => setTimeout(r, MitsubishiController.waitTimeAfterCommand));
        const newState = await this.fetchStatus(false);
        return newState;
      } finally {
        this.isCommandInProgress = false;
      }
    });
  }
  async ensureDeviceState() {
    if (!this.parsedDeviceState || !this.parsedDeviceState.general) {
      await this.fetchStatus();
    }
  }
  async getChangeset() {
    var _a, _b;
    await this.ensureDeviceState();
    return new import_mitsubishiChangeset.MitsubishiChangeSet((_b = (_a = this.parsedDeviceState) == null ? void 0 : _a.general) != null ? _b : new import_types.GeneralStates());
  }
  async applyChangeset(changeset) {
    await this.ensureDeviceState();
    if (!this.pendingChangeset) {
      this.pendingChangeset = changeset;
    } else {
      this.pendingChangeset.merge(changeset);
    }
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }
    return new Promise((resolve, reject) => {
      this.pendingTimer = setTimeout(() => {
        this.flushPendingChangeset().then(resolve).catch(reject);
      }, this.coalesceDelayMs);
    });
  }
  async flushPendingChangeset() {
    const changeset = this.pendingChangeset;
    this.pendingChangeset = null;
    this.pendingTimer = null;
    if (!changeset || changeset.empty) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.commandQueue.push(async () => {
        try {
          let newState;
          if (changeset.changes !== import_types.Controls.NoControl) {
            newState = await this.sendGeneralCommand(changeset.desiredState, changeset.changes);
          } else if (changeset.changes08 !== import_types.Controls08.NoControl) {
            newState = await this.sendExtend08Command(changeset.desiredState, changeset.changes08);
          }
          resolve(newState);
          return newState;
        } catch (err) {
          this.log.warn(`Failed to send coalesced command: ${err.message}`);
          reject(err);
        }
      });
      void this.processCommandQueue();
    });
  }
  async processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }
    this.isProcessingQueue = true;
    try {
      while (this.commandQueue.length > 0) {
        const nextCommand = this.commandQueue.shift();
        if (nextCommand) {
          try {
            await nextCommand();
          } catch (error) {
            this.log.warn(`Command in queue failed: ${error.message}`);
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  async setPower(on) {
    const changeset = await this.getChangeset();
    changeset.setPower(on);
    return this.applyChangeset(changeset);
  }
  async setTemperature(tempC) {
    const changeset = await this.getChangeset();
    changeset.setTemperature(tempC);
    return this.applyChangeset(changeset);
  }
  async setOperationMode(mode) {
    const changeset = await this.getChangeset();
    changeset.setOperationMode(mode);
    return this.applyChangeset(changeset);
  }
  async setFanSpeed(speed) {
    const changeset = await this.getChangeset();
    changeset.setFanSpeed(speed);
    return this.applyChangeset(changeset);
  }
  async setVerticalVane(v) {
    const changeset = await this.getChangeset();
    changeset.setVerticalVane(v);
    return this.applyChangeset(changeset);
  }
  async setHorizontalVane(h) {
    const changeset = await this.getChangeset();
    changeset.setHorizontalVane(h);
    return this.applyChangeset(changeset);
  }
  async setDehumidifier(setting) {
    const changeset = await this.getChangeset();
    changeset.setDehumidifier(setting);
    return this.applyChangeset(changeset);
  }
  async setPowerSaving(enabled) {
    const changeset = await this.getChangeset();
    changeset.setPowerSaving(enabled);
    return this.applyChangeset(changeset);
  }
  async triggerBuzzer() {
    const changeset = await this.getChangeset();
    changeset.triggerBuzzer();
    return this.applyChangeset(changeset);
  }
  async setRemoteLock(lockFlags) {
    const changeset = await this.getChangeset();
    changeset.setRemoteLock(lockFlags);
    return this.applyChangeset(changeset);
  }
  async sendGeneralCommand(state, controls) {
    const buf = state.generateGeneralCommand(controls);
    this.log.debug(`Sending General Command: ${buf.toString("hex")}`);
    return this.applyHexCommand(buf.toString("hex"));
  }
  async sendExtend08Command(state, controls) {
    const buf = state.generateExtend08Command(controls);
    this.log.debug(`Sending Extend08 Command: ${buf.toString("hex")}`);
    return this.applyHexCommand(buf.toString("hex"));
  }
  async enableEchonet() {
    return this.api.sendEchonetEnable();
  }
  async reboot() {
    return this.api.sendRebootRequest();
  }
  async withLock(fn) {
    return this.mutex.runExclusive(fn);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MitsubishiController
});
//# sourceMappingURL=mitsubishiController.js.map
