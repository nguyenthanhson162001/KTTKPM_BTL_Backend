"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = __importDefault(require("../../../infrastructure/firebase"));
const UserRepository_1 = __importDefault(require("../../../infrastructure/mongoose/repositories/UserRepository"));
exports.default = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const decodeValue = yield firebase_1.default
        .auth()
        .verifyIdToken(token.split(" ")[1]);
    if (!decodeValue)
        throw new Error("Token invalid");
    let user = yield UserRepository_1.default.getOneByIdProvider(decodeValue.uid);
    if (!user)
        throw new Error("User not found");
    return user;
});
