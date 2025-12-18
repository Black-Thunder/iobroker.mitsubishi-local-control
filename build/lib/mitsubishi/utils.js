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
  calcFcc: () => calcFcc,
  padIso7816: () => padIso7816,
  unpadIso7816: () => unpadIso7816
});
module.exports = __toCommonJS(utils_exports);
var import_types = require("./types");
function padIso7816(input, blockSize = import_types.KEY_SIZE) {
  const padLen = blockSize - input.length % blockSize;
  const out = Buffer.alloc(input.length + padLen);
  input.copy(out, 0);
  out[input.length] = 128;
  return out;
}
function unpadIso7816(padded) {
  let i = padded.length - 1;
  while (i >= 0 && padded[i] === 0) {
    i--;
  }
  if (i < 0 || padded[i] !== 128) {
    throw new Error("Invalid ISO7816 padding");
  }
  return padded.subarray(0, i);
}
function calcFcc(payload) {
  const slice = payload.subarray(0, 20);
  const sum = slice.reduce((s, b) => s + b, 0);
  return (256 - sum % 256) % 256;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  calcFcc,
  padIso7816,
  unpadIso7816
});
//# sourceMappingURL=utils.js.map
