const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const ReplySchema = new mongoose.Schema(
  {
    replyBy: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Reply", ReplySchema);
