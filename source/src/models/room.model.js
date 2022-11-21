const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const MessageSchema = require('./message.model');
const RoomSchema = Schema(
  {
    name: {
      type: String,
      trim: true,
      minlenght: 3
    },
    users: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'User',
      }
    ],
    group: Boolean,
    avatar: String,
    active: {
      type: Boolean,
      default: true,
    },
    roomMaster: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      }
    ],
    messages: [
    ],
    pinMessage: []
  },
  {
    timestamps: true,

  }
);

const Rooms = mongoose.model("Room", RoomSchema);
module.exports = Rooms;
