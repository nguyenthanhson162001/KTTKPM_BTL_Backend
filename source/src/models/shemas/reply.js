const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');

const ReplySchema = new mongoose.Schema(
    {
        replyBy: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        content: { type: String }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

ReplySchema.plugin(Timezone);

module.exports = mongoose.model('Reply', ReplySchema);
