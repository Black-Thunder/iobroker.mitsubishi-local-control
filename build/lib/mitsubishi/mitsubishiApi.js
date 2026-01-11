"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mitsubishiApi_exports = {};
__export(mitsubishiApi_exports, {
  MitsubishiAPI: () => MitsubishiAPI
});
module.exports = __toCommonJS(mitsubishiApi_exports);
var import_axios = __toESM(require("axios"));
var crypto = __toESM(require("node:crypto"));
var import_types = require("./types");
var import_utils = require("./utils");
class MitsubishiAPI {
  adapter;
  deviceHostPort;
  encryptionKey;
  http;
  constructor(deviceHostPort, adapter, encryptionKey = import_types.STATIC_KEY) {
    this.deviceHostPort = deviceHostPort;
    this.adapter = adapter;
    if (typeof encryptionKey === "string") {
      encryptionKey = Buffer.from(encryptionKey, "utf8");
    }
    if (encryptionKey.length < import_types.KEY_SIZE) {
      encryptionKey = Buffer.concat([encryptionKey, Buffer.alloc(import_types.KEY_SIZE - encryptionKey.length, 0)]);
    }
    this.encryptionKey = encryptionKey.subarray(0, import_types.KEY_SIZE);
    this.http = import_axios.default.create({
      timeout: 2e3,
      headers: {
        "User-Agent": "KirigamineRemote/5.1.0 (jp.co.MitsubishiElectric.KirigamineRemote; build:3; iOS 17.5.1) Alamofire/5.9.1"
      },
      // do not automatically throw for non-2xx; we will call resp.status/raise manually
      validateStatus: () => true
    });
  }
  getCryptoKey() {
    return this.encryptionKey;
  }
  getDeviceHostPort() {
    return this.deviceHostPort;
  }
  /**
   * Encrypt payload using AES-CBC with ISO7816-4 padding
   * Returns base64(iv + ciphertext)
   */
  encryptPayload(payload, iv) {
    if (!iv) {
      iv = crypto.randomBytes(import_types.KEY_SIZE);
    }
    const cipher = crypto.createCipheriv("aes-128-cbc", this.encryptionKey, iv);
    cipher.setAutoPadding(false);
    const payloadBytes = Buffer.from(payload, "utf8");
    const padded = (0, import_utils.padIso7816)(payloadBytes, import_types.KEY_SIZE);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString("base64");
  }
  /**
   * Decrypt base64(iv + ciphertext) using AES-CBC + ISO7816 unpad fallback.
   * Try iso7816 unpad; on failure strip trailing \x00;
   * then try to decode UTF-8; on UnicodeDecodeError search for closing tags and fallback to ignore errors.
   */
  decryptPayload(payload_b64) {
    const encrypted = Buffer.from(payload_b64, "base64");
    const iv = encrypted.subarray(0, import_types.KEY_SIZE);
    const encrypted_data = encrypted.subarray(import_types.KEY_SIZE);
    const decipher = crypto.createDecipheriv("aes-128-cbc", this.encryptionKey, iv);
    decipher.setAutoPadding(false);
    let decrypted;
    try {
      decrypted = Buffer.concat([decipher.update(encrypted_data), decipher.final()]);
    } catch (e) {
      throw new Error(`Decryption failed: ${e.message}`);
    }
    let decrypted_clean;
    try {
      decrypted_clean = (0, import_utils.unpadIso7816)(decrypted);
    } catch {
      let end = decrypted.length;
      while (end > 0 && decrypted[end - 1] === 0) {
        end--;
      }
      decrypted_clean = decrypted.subarray(0, end);
    }
    try {
      const result = decrypted_clean.toString("utf8");
      return result;
    } catch {
    }
    const xml_end_patterns = [Buffer.from("</LSV>"), Buffer.from("</CSV>"), Buffer.from("</ESV>")];
    for (const pattern of xml_end_patterns) {
      const pos = decrypted_clean.indexOf(pattern);
      if (pos !== -1) {
        const end_pos = pos + pattern.length;
        const truncated = decrypted_clean.subarray(0, end_pos);
        try {
          return truncated.toString("utf8");
        } catch {
        }
      }
    }
    const fallback_result = decrypted_clean.toString("utf8");
    return fallback_result;
  }
  /**
   * Make HTTP request to /smart endpoint.
   * Encrypt payload, wrap in <ESV>..</ESV>, POST, parse response, decrypt.
   */
  async makeRequest(payload_xml) {
    const encrypted_payload = this.encryptPayload(payload_xml);
    const request_body = `<?xml version="1.0" encoding="UTF-8"?><ESV>${encrypted_payload}</ESV>`;
    const headers = {
      Host: `${this.deviceHostPort}`,
      "Content-Type": "text/plain;chrset=UTF-8",
      Connection: "keep-alive",
      "Proxy-Connection": "keep-alive",
      Accept: "*/*",
      "User-Agent": "KirigamineRemote/5.1.0 (jp.co.MitsubishiElectric.KirigamineRemote; build:3; iOS 17.5.1) Alamofire/5.9.1",
      "Accept-Language": "zh-Hant-JP;q=1.0, ja-JP;q=0.9"
    };
    const url = `http://${this.deviceHostPort}/smart`;
    const maxRetries = 4;
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await this.http.post(url, request_body, { headers, timeout: 2e3 });
        this.raiseForStatus(resp);
        const m = String(resp.data).match(/<ESV>\s*([^<]+)\s*<\/ESV>/i);
        const encrypted_response = m == null ? void 0 : m[1];
        if (encrypted_response) {
          if (encrypted_response.length % 4 !== 0) {
            this.adapter.log.error(`Invalid base64 length: ${encrypted_response.length}`);
          }
          const decrypted = this.decryptPayload(encrypted_response);
          return decrypted;
        }
        throw new Error("Could not find any text in response");
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          const wait = attempt === 0 ? 0 : 1e3 * Math.pow(2, attempt - 1);
          await new Promise((r) => this.adapter.setTimeout(r, wait, void 0));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
  }
  raiseForStatus(resp) {
    if (resp.status >= 400 && resp.status < 600) {
      const err = new Error(`${resp.status} ${resp.status >= 500 ? "Server" : "Client"} Error`);
      err.status = resp.status;
      err.body = resp.data;
      throw err;
    }
  }
  sendRebootRequest() {
    return this.makeRequest("<CSV><RESET></RESET></CSV>");
  }
  sendStatusRequest() {
    return this.makeRequest("<CSV><CONNECT>ON</CONNECT></CSV>");
  }
  sendEchonetEnable() {
    return this.makeRequest("<CSV><CONNECT>ON</CONNECT><ECHONET>ON</ECHONET></CSV>");
  }
  sendCommand(command) {
    const hex = Buffer.isBuffer(command) ? command.toString("hex") : Buffer.from(command).toString("hex");
    return this.sendHexCommand(hex);
  }
  sendHexCommand(hexCommand) {
    const payload = `<CSV><CONNECT>ON</CONNECT><CODE><VALUE>${hexCommand}</VALUE></CODE></CSV>`;
    return this.makeRequest(payload);
  }
  close() {
    this.http = null;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MitsubishiAPI
});
//# sourceMappingURL=mitsubishiApi.js.map
