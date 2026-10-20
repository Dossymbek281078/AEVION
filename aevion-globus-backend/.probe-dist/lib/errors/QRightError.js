"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRightError = void 0;
class QRightError extends Error {
    constructor(code, httpStatus, message) {
        super(message || code);
        this.name = "QRightError";
        this.code = code;
        this.httpStatus = httpStatus;
        Object.setPrototypeOf(this, QRightError.prototype);
    }
    toJSON() {
        return { code: this.code, message: this.message };
    }
}
exports.QRightError = QRightError;
