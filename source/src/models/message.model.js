const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');

const MessageSchema = new mongoose.Schema(
    {
        receiver: {
            type: [ObjectId],
            default: [],
        },
        sender: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: [
                'TEXT',
                'IMAGE',
                'GIF',
                'VIDEO',
                'FILE',
                'NOTIFY'
            ],
            default: 'TEXT'
        }
        ,
        room: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        reaction: {
            type: String,
            enum: ['HAHA', 'SAD', 'LIKE', 'ANGRY', 'LOVE', 'WOW', 'NONE'],
            default: 'NONE'
        },
        readMessage: {
            type: Boolean,
            default: false, //false Chưa xem
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

MessageSchema.plugin(Timezone);

module.exports = mongoose.model('Message', MessageSchema);
