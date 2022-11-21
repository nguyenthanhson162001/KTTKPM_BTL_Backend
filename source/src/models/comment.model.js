const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');
const ReplySchema = require('../models/shemas/reply');

const CommentSchema = new mongoose.Schema(
    {
        commentBy: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: true
        },
        numberOfLikes: {
            type: Number,
            default: 0,
            required: true
        },
        likes: [
            {
                type: mongoose.Types.ObjectId,
                ref: 'User',
                required: true
            }
        ],
        content: {
            type: String,
            required: true
        },
        replies: []
    },
    {
        timestamps: true,
        versionKey: false
    }
);

CommentSchema.plugin(Timezone);

module.exports = mongoose.model('Comment', CommentSchema);