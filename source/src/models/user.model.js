const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const authSchema = require('./shemas/auth');
const Timezone = require('mongoose-timezone');
const ObjectId = mongoose.Types.ObjectId;
const objectIdHelper = require('../utils/objectId.helper');
const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            required: true
        },
        email: {
            type: String,
            unique: true,
            required: true
        },
        phone: {
            type: String
        },
        auth: authSchema,
        name: {
            type: String,
            default: null
        },
        gender: {
            type: String,
            default: null
        },
        dob: {
            type: Date,
            default: null
        },
        bio: {
            type: String,
            default: null
        },
        socketId: {
            type: String,
            default: "",
        },
        image: {
            type: String,
            default: ""
        },
        posts: [
            {
                type: ObjectId,
                ref: 'Post'
            }
        ],
        friends: [
            {
                type: ObjectId,
                ref: 'User'
            }
        ],
        rooms: [
            {
                type: ObjectId,
                ref: 'Room'
            }
        ],
        notifications: [
            {
                type: ObjectId,
                ref: 'Notification'
            }
        ],
        blocks: [
            {

            }
        ],
        expireTag: {
            type: ObjectId
        },
        isActived: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

UserSchema.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: ['find', 'findOne', 'aggregate']
});
UserSchema.plugin(Timezone);

UserSchema.statics.checkByIds = async (ids) => {
    for (const idEle of ids) {
        console.log("🚀 ~ file: user.model.js ~ line 98 ~ UserSchema.statics.checkByIds= ~ idEle", idEle)
        
        const user = await User.findOne({
            _id: idEle,
            isActived: true
        });

        if (!user) throw new Error('Not found user');
    }
};

UserSchema.statics.checkById = async (_id) => {
    const user = await User.findOne({ _id, isActived: true });

    if (!user) throw new Error('not found user');

    return user;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;