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
const Client_1 = require("../Client");
const getUserByToken_1 = __importDefault(require("../util/getUserByToken"));
exports.default = ({ token, client }) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, getUserByToken_1.default)(token);
    const userId = String(user._id);
    if (client.status == Client_1.StatusClient.Disconect)
        return;
    let userDriver = client.socketMain.users.get(userId);
    if (userDriver) {
        userDriver.dirver++;
    }
    else {
        userDriver = {
            dirver: 1,
            user: user,
        };
    }
    client.socketMain.users.set(userId, userDriver);
    client.status = Client_1.StatusClient.AsyncUser;
    client.socket.join(userId); // join socket
    client.userId = userId;
});
