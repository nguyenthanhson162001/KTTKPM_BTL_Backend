const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');

const PostSchema = new mongoose.Schema(
    {
        user: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        caption: {
            type: String,
            required: true
        },
        access: {
            type: String,
            enum: ['PUBLIC', 'PRIVATE'],
            default: 'PUBLIC'
        },
        image: [
        ],
        numberOfLikes: {
            type: Number,
            default: 0,
        },
        likes: [
            {
                type: ObjectId,
                ref: 'User'
            }
        ],
        reports: [
            {
                type: ObjectId,
                ref: 'Report'
            }
        ],
        comments: [
            {
                type: ObjectId,
                ref: 'Comment'
            }
        ]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

PostSchema.plugin(Timezone);

module.exports = mongoose.model('Post', PostSchema);