const { required } = require('joi');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Timezone = require('mongoose-timezone');

const RequestSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['ADD_FRIEND'],
            required: true,
            default: 'ADD_FRIEND'
        },
        from: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        fromUsername: {
            type: String,
        },
        to: {
            type: ObjectId,
            ref: 'User',
            required: true
        },
        toUsername: {
            type: String
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
)

RequestSchema.plugin(Timezone);

module.exports = mongoose.model('Request', RequestSchema);