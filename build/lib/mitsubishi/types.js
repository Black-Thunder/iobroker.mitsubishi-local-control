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
var types_exports = {};
__export(types_exports, {
  AutoMode: () => AutoMode,
  AutoStates: () => AutoStates,
  Controls: () => Controls,
  Controls08: () => Controls08,
  DriveMode: () => DriveMode,
  EnergyStates: () => EnergyStates,
  ErrorStates: () => ErrorStates,
  GeneralStates: () => GeneralStates,
  HorizontalWindDirection: () => HorizontalWindDirection,
  KEY_SIZE: () => KEY_SIZE,
  ParsedDeviceState: () => ParsedDeviceState,
  PowerOnOff: () => PowerOnOff,
  RemoteLock: () => RemoteLock,
  STATIC_KEY: () => STATIC_KEY,
  SensorStates: () => SensorStates,
  VerticalWindDirection: () => VerticalWindDirection,
  WindSpeed: () => WindSpeed
});
module.exports = __toCommonJS(types_exports);
var import_utils = require("./utils");
const KEY_SIZE = 16;
const STATIC_KEY = Buffer.from("unregistered\0\0\0\0", "utf8");
var PowerOnOff = /* @__PURE__ */ ((PowerOnOff2) => {
  PowerOnOff2[PowerOnOff2["OFF"] = 0] = "OFF";
  PowerOnOff2[PowerOnOff2["ON"] = 1] = "ON";
  return PowerOnOff2;
})(PowerOnOff || {});
var DriveMode = /* @__PURE__ */ ((DriveMode2) => {
  DriveMode2[DriveMode2["AUTO"] = 0] = "AUTO";
  DriveMode2[DriveMode2["HEATER"] = 1] = "HEATER";
  DriveMode2[DriveMode2["DEHUM"] = 2] = "DEHUM";
  DriveMode2[DriveMode2["COOLER"] = 3] = "COOLER";
  DriveMode2[DriveMode2["FAN"] = 7] = "FAN";
  return DriveMode2;
})(DriveMode || {});
var WindSpeed = /* @__PURE__ */ ((WindSpeed2) => {
  WindSpeed2[WindSpeed2["AUTO"] = 0] = "AUTO";
  WindSpeed2[WindSpeed2["S1"] = 1] = "S1";
  WindSpeed2[WindSpeed2["S2"] = 2] = "S2";
  WindSpeed2[WindSpeed2["S3"] = 3] = "S3";
  WindSpeed2[WindSpeed2["S4"] = 5] = "S4";
  WindSpeed2[WindSpeed2["FULL"] = 6] = "FULL";
  return WindSpeed2;
})(WindSpeed || {});
var VerticalWindDirection = /* @__PURE__ */ ((VerticalWindDirection2) => {
  VerticalWindDirection2[VerticalWindDirection2["AUTO"] = 0] = "AUTO";
  VerticalWindDirection2[VerticalWindDirection2["V1"] = 1] = "V1";
  VerticalWindDirection2[VerticalWindDirection2["V2"] = 2] = "V2";
  VerticalWindDirection2[VerticalWindDirection2["V3"] = 3] = "V3";
  VerticalWindDirection2[VerticalWindDirection2["V4"] = 4] = "V4";
  VerticalWindDirection2[VerticalWindDirection2["V5"] = 5] = "V5";
  VerticalWindDirection2[VerticalWindDirection2["SWING"] = 7] = "SWING";
  return VerticalWindDirection2;
})(VerticalWindDirection || {});
var HorizontalWindDirection = /* @__PURE__ */ ((HorizontalWindDirection2) => {
  HorizontalWindDirection2[HorizontalWindDirection2["AUTO"] = 0] = "AUTO";
  HorizontalWindDirection2[HorizontalWindDirection2["FAR_LEFT"] = 1] = "FAR_LEFT";
  HorizontalWindDirection2[HorizontalWindDirection2["LEFT"] = 2] = "LEFT";
  HorizontalWindDirection2[HorizontalWindDirection2["CENTER"] = 3] = "CENTER";
  HorizontalWindDirection2[HorizontalWindDirection2["RIGHT"] = 4] = "RIGHT";
  HorizontalWindDirection2[HorizontalWindDirection2["FAR_RIGHT"] = 5] = "FAR_RIGHT";
  HorizontalWindDirection2[HorizontalWindDirection2["LEFT_CENTER"] = 6] = "LEFT_CENTER";
  HorizontalWindDirection2[HorizontalWindDirection2["CENTER_RIGHT"] = 7] = "CENTER_RIGHT";
  HorizontalWindDirection2[HorizontalWindDirection2["LEFT_RIGHT"] = 8] = "LEFT_RIGHT";
  HorizontalWindDirection2[HorizontalWindDirection2["LEFT_CENTER_RIGHT"] = 9] = "LEFT_CENTER_RIGHT";
  HorizontalWindDirection2[HorizontalWindDirection2["SWING"] = 12] = "SWING";
  return HorizontalWindDirection2;
})(HorizontalWindDirection || {});
var AutoMode = /* @__PURE__ */ ((AutoMode2) => {
  AutoMode2[AutoMode2["OFF"] = 0] = "OFF";
  AutoMode2[AutoMode2["SWITCHING"] = 1] = "SWITCHING";
  AutoMode2[AutoMode2["AUTO_HEATING"] = 2] = "AUTO_HEATING";
  AutoMode2[AutoMode2["AUTO_COOLING"] = 3] = "AUTO_COOLING";
  return AutoMode2;
})(AutoMode || {});
var RemoteLock = /* @__PURE__ */ ((RemoteLock2) => {
  RemoteLock2[RemoteLock2["UNLOCKED"] = 0] = "UNLOCKED";
  RemoteLock2[RemoteLock2["POWER_LOCKED"] = 1] = "POWER_LOCKED";
  RemoteLock2[RemoteLock2["MODE_LOCKED"] = 2] = "MODE_LOCKED";
  RemoteLock2[RemoteLock2["TEMPERATURE_LOCKED"] = 3] = "TEMPERATURE_LOCKED";
  return RemoteLock2;
})(RemoteLock || {});
var Controls = /* @__PURE__ */ ((Controls2) => {
  Controls2[Controls2["NoControl"] = 0] = "NoControl";
  Controls2[Controls2["PowerOnOff"] = 256] = "PowerOnOff";
  Controls2[Controls2["DriveMode"] = 512] = "DriveMode";
  Controls2[Controls2["Temperature"] = 1024] = "Temperature";
  Controls2[Controls2["WindSpeed"] = 2048] = "WindSpeed";
  Controls2[Controls2["UpDownWindDirection"] = 4096] = "UpDownWindDirection";
  Controls2[Controls2["RemoteLock"] = 16384] = "RemoteLock";
  Controls2[Controls2["LeftRightWindDirect"] = 1] = "LeftRightWindDirect";
  Controls2[Controls2["OutsideControl"] = 2] = "OutsideControl";
  return Controls2;
})(Controls || {});
var Controls08 = /* @__PURE__ */ ((Controls082) => {
  Controls082[Controls082["NoControl"] = 0] = "NoControl";
  Controls082[Controls082["Dehum"] = 4] = "Dehum";
  Controls082[Controls082["PowerSaving"] = 8] = "PowerSaving";
  Controls082[Controls082["Buzzer"] = 16] = "Buzzer";
  Controls082[Controls082["WindAndWindBreak"] = 32] = "WindAndWindBreak";
  return Controls082;
})(Controls08 || {});
class SensorStates {
  insideTemperature1Coarse = 24;
  outsideTemperature = 21;
  insideTemperature1Fine = 24.5;
  insideTemperature2 = 24;
  runtimeMinutes = 0;
  static isSensorStatesPayload(data) {
    return data.length >= 6 && (data[1] === 98 || data[1] === 123) && data[5] === 3;
  }
  static parseSensorStates(data) {
    if (data[0] !== 252) {
      throw new Error("Invalid sensor payload");
    }
    if (data[5] !== 3) {
      throw new Error("Not sensor states");
    }
    const fcc = (0, import_utils.calcFcc)(data.subarray(1, -1));
    if (fcc !== data[data.length - 1]) {
      throw new Error("Invalid checksum");
    }
    const obj = new SensorStates();
    obj.insideTemperature1Coarse = 10 + data[8];
    obj.outsideTemperature = (data[10] - 128) * 0.5;
    obj.insideTemperature1Fine = (data[11] - 128) * 0.5;
    obj.insideTemperature2 = (data[12] - 128) * 0.5;
    obj.runtimeMinutes = data.readUInt32BE(15) & 16777215;
    return obj;
  }
}
class ErrorStates {
  errorCode = 32768;
  get isAbnormalState() {
    return this.errorCode !== 32768;
  }
  static isErrorStatesPayload(data) {
    return data.length >= 6 && (data[1] === 98 || data[1] === 123) && data[5] === 4;
  }
  static parseErrorStates(data) {
    if (data[0] !== 252) {
      throw new Error("Invalid error payload");
    }
    if (data[5] !== 4) {
      throw new Error("Not error states");
    }
    const fcc = (0, import_utils.calcFcc)(data.subarray(1, -1));
    if (fcc !== data[data.length - 1]) {
      throw new Error("Invalid checksum");
    }
    const obj = new ErrorStates();
    obj.errorCode = data.readUInt16BE(9);
    return obj;
  }
}
class EnergyStates {
  operating = false;
  powerWatt = 0;
  energyHectoWattHour = 0;
  static isEnergyStatesPayload(data) {
    return data.length >= 6 && (data[1] === 98 || data[1] === 123) && data[5] === 6;
  }
  static parseEnergyStates(data) {
    if (data[0] !== 252) {
      throw new Error("Invalid energy payload");
    }
    if (data[5] !== 6) {
      throw new Error("Not energy states");
    }
    const fcc = (0, import_utils.calcFcc)(data.subarray(1, -1));
    if (fcc !== data[data.length - 1]) {
      throw new Error("Invalid checksum");
    }
    const obj = new EnergyStates();
    obj.operating = data[9] !== 0;
    obj.powerWatt = data.readUInt16BE(10);
    obj.energyHectoWattHour = data.readUInt16BE(12);
    return obj;
  }
}
class AutoStates {
  powerMode = 0;
  autoMode = 0;
  // AutoMode enum equivalent
  static isAutoStatesPayload(data) {
    return data.length >= 6 && (data[1] === 98 || data[1] === 123) && data[5] === 9;
  }
  static parseAutoStates(data) {
    if (data[0] !== 252) {
      throw new Error("Invalid auto payload");
    }
    if (data[5] !== 9) {
      throw new Error("Not auto states");
    }
    const fcc = (0, import_utils.calcFcc)(data.subarray(1, -1));
    if (fcc !== data[data.length - 1]) {
      throw new Error("Invalid checksum");
    }
    const obj = new AutoStates();
    obj.powerMode = data[9];
    obj.autoMode = data[10];
    return obj;
  }
}
class GeneralStates {
  powerOnOff = 0 /* OFF */;
  driveMode = 0 /* AUTO */;
  coarseTemperature = 22;
  fineTemperature = 22;
  windSpeed = 0 /* AUTO */;
  verticalWindDirection = 0 /* AUTO */;
  remoteLock = 0 /* UNLOCKED */;
  horizontalWindDirection = 0 /* AUTO */;
  dehumSetting = 0;
  isPowerSaving = false;
  windAndWindBreakDirect = 0;
  iSeeSensor = true;
  wideVaneAdjustment = false;
  constructor(other) {
    if (other) {
      Object.assign(this, other);
    }
  }
  static isGeneralStatesPayload(data) {
    return data.length >= 6 && (data[1] === 98 || data[1] === 123) && data[5] === 2;
  }
  static parseGeneralStates(data) {
    if (data[0] !== 252) {
      throw new Error("Invalid general payload");
    }
    if (data[5] !== 2) {
      throw new Error("Not general states");
    }
    const fcc = (0, import_utils.calcFcc)(data.subarray(1, -1));
    if (fcc !== data[data.length - 1]) {
      throw new Error("Invalid checksum");
    }
    const obj = new GeneralStates();
    obj.powerOnOff = data[8] === 1 ? 1 /* ON */ : 0 /* OFF */;
    obj.driveMode = data[9] & 7;
    obj.coarseTemperature = 31 - data[10];
    obj.windSpeed = data[11];
    obj.verticalWindDirection = data[12];
    obj.remoteLock = data[13];
    obj.horizontalWindDirection = data[15] & 15;
    obj.wideVaneAdjustment = (data[15] & 240) === 128;
    obj.fineTemperature = data[16] !== 0 ? (data[16] - 128) / 2 : null;
    obj.dehumSetting = data[17];
    obj.isPowerSaving = data[18] > 0;
    obj.windAndWindBreakDirect = data[19];
    return obj;
  }
  get temperature() {
    var _a;
    return (_a = this.fineTemperature) != null ? _a : this.coarseTemperature;
  }
  set temperature(v) {
    this.fineTemperature = v;
    this.coarseTemperature = Math.floor(v);
  }
  // generate_general_command -> returns Buffer
  generateGeneralCommand(controls) {
    const body = Buffer.alloc(20, 0);
    body[0] = 65;
    body[1] = 1;
    body[2] = 48;
    body[3] = 16;
    body[4] = 1;
    const ctrl = controls | 2 /* OutsideControl */;
    body.writeUInt16BE(ctrl & 65535, 5);
    body[7] = this.powerOnOff & 255;
    body[8] = typeof this.driveMode === "number" ? this.driveMode : Number(this.driveMode);
    body[9] = 31 - Math.floor(this.temperature);
    body[10] = this.windSpeed & 255;
    body[11] = this.verticalWindDirection & 255;
    body[12] = 0;
    body[13] = 0;
    body[14] = 0;
    body[15] = this.remoteLock & 255;
    body[16] = 0;
    body[17] = this.horizontalWindDirection & 255;
    body[18] = this.fineTemperature !== null ? 128 + Math.floor(this.fineTemperature * 2) & 255 : 0;
    body[19] = 65;
    const fcc = (0, import_utils.calcFcc)(body);
    return Buffer.concat([Buffer.from([252]), body, Buffer.from([fcc])]);
  }
  generateExtend08Command(controls08) {
    const body = Buffer.alloc(20, 0);
    body[0] = 65;
    body[1] = 1;
    body[2] = 48;
    body[3] = 16;
    body[4] = 8;
    body[5] = controls08 & 255;
    body[8] = controls08 & 4 /* Dehum */ ? this.dehumSetting & 255 : 0;
    body[9] = this.isPowerSaving ? 10 : 0;
    body[10] = controls08 & 32 /* WindAndWindBreak */ ? this.windAndWindBreakDirect & 255 : 0;
    body[11] = controls08 & 16 /* Buzzer */ ? 1 : 0;
    const fcc = (0, import_utils.calcFcc)(body);
    return Buffer.concat([Buffer.from([252]), body, Buffer.from([fcc])]);
  }
}
class ParsedDeviceState {
  general;
  sensors = void 0;
  errors = void 0;
  energy = void 0;
  autoState = void 0;
  ip = "";
  mac = "";
  serial = "";
  rssi = "";
  app_version = "";
  constructor() {
    this.general = new GeneralStates();
    this.sensors = new SensorStates();
    this.errors = new ErrorStates();
    this.energy = new EnergyStates();
    this.autoState = new AutoStates();
  }
  static parseCodeValues(codeValues) {
    const parsed = new ParsedDeviceState();
    for (const hexValue of codeValues) {
      if (!hexValue || hexValue.length < 2) {
        continue;
      }
      const data = Buffer.from(hexValue, "hex");
      if (GeneralStates.isGeneralStatesPayload(data)) {
        parsed.general = GeneralStates.parseGeneralStates(data);
      } else if (SensorStates.isSensorStatesPayload(data)) {
        parsed.sensors = SensorStates.parseSensorStates(data);
      } else if (ErrorStates.isErrorStatesPayload(data)) {
        parsed.errors = ErrorStates.parseErrorStates(data);
      } else if (EnergyStates.isEnergyStatesPayload(data)) {
        parsed.energy = EnergyStates.parseEnergyStates(data);
      } else if (AutoStates.isAutoStatesPayload(data)) {
        parsed.autoState = AutoStates.parseAutoStates(data);
      }
    }
    return parsed;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AutoMode,
  AutoStates,
  Controls,
  Controls08,
  DriveMode,
  EnergyStates,
  ErrorStates,
  GeneralStates,
  HorizontalWindDirection,
  KEY_SIZE,
  ParsedDeviceState,
  PowerOnOff,
  RemoteLock,
  STATIC_KEY,
  SensorStates,
  VerticalWindDirection,
  WindSpeed
});
//# sourceMappingURL=types.js.map
