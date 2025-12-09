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
  MitsubishiChangeSet: () => MitsubishiChangeSet,
  MitsubishiController: () => MitsubishiController
});
module.exports = __toCommonJS(mitsubishiController_exports);
var import_buffer = require("buffer");
var import_fast_xml_parser = require("fast-xml-parser");
var import_mitsubishiApi = require("./mitsubishiApi");
var import_types = require("./types");
const xmlParser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  trimValues: true
});
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
    this.desiredState.powerOnOff = power;
    this.changes |= import_types.Controls.PowerOnOff;
  }
  setMode(driveMode) {
    this.desiredState.driveMode = driveMode;
    this.changes |= import_types.Controls.DriveMode;
  }
  setTemperature(temperature) {
    this.desiredState.temperature = temperature;
    this.changes |= import_types.Controls.Temperature;
  }
  setDehumidifier(humidity) {
    this.desiredState.dehumSetting = humidity;
    this.changes08 |= import_types.Controls08.Dehum;
  }
  setFanSpeed(fanSpeed) {
    this.desiredState.windSpeed = fanSpeed;
    this.changes |= import_types.Controls.WindSpeed;
  }
  setVerticalVane(vVane) {
    this.desiredState.verticalWindDirection = vVane;
    this.changes |= import_types.Controls.UpDownWindDirection;
  }
  setHorizontalVane(hVane) {
    this.desiredState.horizontalWindDirection = hVane;
    this.changes |= import_types.Controls.LeftRightWindDirect;
  }
  setPowerSaving(powerSaving) {
    this.desiredState.isPowerSaving = powerSaving;
    this.changes08 |= import_types.Controls08.PowerSaving;
  }
}
class MitsubishiController {
  parsedDeviceState = null;
  log;
  api;
  profile_code = [];
  static waitTimeAfterCommand = 5e3;
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
  async fetchStatus() {
    var _a;
    const resp = await this.api.sendStatusRequest();
    this.parsedDeviceState = (_a = this.parsedDeviceState) != null ? _a : new import_types.ParsedDeviceState();
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
      this.parsedDeviceState.app_version = appVer.toString();
    }
    this.profile_code = [];
    const profiles1 = this.extractTagList(rootObj, ["PROFILECODE", "DATA", "VALUE"]);
    const profiles2 = this.extractTagList(rootObj, ["PROFILECODE", "VALUE"]);
    const mergedProfiles = [...profiles1, ...profiles2];
    for (const hex of mergedProfiles) {
      try {
        this.profile_code.push(import_buffer.Buffer.from(hex, "hex"));
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
    const resp = await this.api.sendHexCommand(hex);
    await new Promise((r) => setTimeout(r, MitsubishiController.waitTimeAfterCommand));
    return resp;
  }
  async ensureDeviceState() {
    if (!this.parsedDeviceState || !this.parsedDeviceState.general) {
      await this.fetchStatus();
    }
  }
  async getChangeset() {
    var _a, _b;
    await this.ensureDeviceState();
    return new MitsubishiChangeSet((_b = (_a = this.parsedDeviceState) == null ? void 0 : _a.general) != null ? _b : new import_types.GeneralStates());
  }
  async applyChangeset(changeset) {
    let newState = void 0;
    if (changeset.changes !== import_types.Controls.NoControl) {
      newState = await this.sendGeneralCommand(changeset.desiredState, changeset.changes);
    } else if (changeset.changes08 !== import_types.Controls08.NoControl) {
      newState = await this.sendExtend08Command(changeset.desiredState, changeset.changes08);
    }
    return newState;
  }
  async setPower(on) {
    const changeset = await this.getChangeset();
    changeset.setPower(on ? import_types.PowerOnOff.ON : import_types.PowerOnOff.OFF);
    return this.applyChangeset(changeset);
  }
  async setTemperature(tempC) {
    const changeset = await this.getChangeset();
    changeset.setTemperature(tempC);
    return this.applyChangeset(changeset);
  }
  async setMode(mode) {
    const changeset = await this.getChangeset();
    changeset.setMode(mode);
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
  /*async sendBuzzerCommand(enabled = true): Promise<ParsedDeviceState | undefined> {
  		const changeset = await this.getChangeset();
  		const s = this.parsedDeviceState ?? new ParsedDeviceState();
  		const buf = s.general.generateExtend08Command(Controls08.Buzzer);
  		return this.applyHexCommand(buf.toString("hex"));
  	}
  
  	async setRemoteLock(lockFlags: number): Promise<ParsedDeviceState | undefined> {
  		const changeset = await this.getChangeset();
  		const s = this.parsedDeviceState ?? new ParsedDeviceState();
  		s.general.remoteLock = lockFlags;
  		const buf = s.general.generateGeneralCommand(Controls.RemoteLock);
  		return this.applyHexCommand(buf.toString("hex"));
  	}*/
  async sendGeneralCommand(state, controls) {
    const buf = state.generateGeneralCommand(controls);
    this.log.debug(`Sending General Command: ${buf.toString("hex")}`);
    const response = await this.applyHexCommand(buf.toString("hex"));
    return this.parseStatusResponse(response);
  }
  async sendExtend08Command(state, controls) {
    const buf = state.generateExtend08Command(controls);
    this.log.debug(`Sending Extend08 Command: ${buf.toString("hex")}`);
    const response = await this.applyHexCommand(buf.toString("hex"));
    return this.parseStatusResponse(response);
  }
  async enableEchonet() {
    return this.api.sendEchonetEnable();
  }
  async reboot() {
    return this.api.sendRebootRequest();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MitsubishiChangeSet,
  MitsubishiController
});
//# sourceMappingURL=mitsubishiController.js.map
