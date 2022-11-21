const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');

const NotificationSchema = new mongoose.Schema(
    {
        user: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        requestedUserId: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        requestAccount: {
            type: String
        },
        requestUserName: {
            type: String
        },
        type: {
            type: String,
            enum: ['ADD_FRIEND_REQUEST', 'REACT_POST', 'REACT_MESSAGE',
                'REACT_COMMENT', 'COMMENT', 'REPLY', 'MESSAGE']
        },
        relatedUsers: {
            from: {
                type: String,
            },
            of: {
                type: String
            }
        },
        isChecked: {
            type: Boolean,
            default: false
        },
        tag: [
            {
                type: ObjectId,
                require: true
            }
        ]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

NotificationSchema.plugin(Timezone);

NotificationSchema.statics.getNotification = async (user, type, requestedUserId) => {
    const notification = null;
    try {
        notification = await NotificationSchema.findOne({
            user: user,
            type: 'ADD_FRIEND_REQUEST',
            requestedUserId: requestedUserId
        });
    } catch (error) {
        console.log(error.message);
    }
    return notification;
};
const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;

