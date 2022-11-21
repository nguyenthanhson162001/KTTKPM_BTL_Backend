const User = require('../../../models/user.model');
const ObjectId = require('mongoose').Types.ObjectId;
const objectIdHelper = require('../../../utils/objectId.helper');

module.exports = async (io, socket) => {
    let listFriendsOnline = await getListFriendsOnline(socket.handshake.auth.userId);
    let userInfo = {
        username: socket.handshake.auth.username,
        useId: socket.handshake.auth.userId
    };

    if (listFriendsOnline.length > 0) {
        socket.emit('home:list_friend_online', listFriendsOnline);
        io.to(listFriendsOnline.map(friend => friend._id)).emit('home:friend_connect', userInfo);
    }

    socket.on('disconnect', () => {
        io.to(listFriendsOnline.map(friend => friend._id)).emit('home:friend_disconnect', userInfo);
        console.log(`Socket ID ${socket.id} disconnect!`);
    });

    async function getListFriendsOnline(_id) {
        let user = await User.aggregate([
            {
                $match: {
                    _id: ObjectId(_id)
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'friends',
                    foreignField: '_id',
                    as: 'friends'
                }
            },
            {
                $project: {
                    _id: 0,
                    friends: {
                        $map: {
                            input: '$friends',
                            in: {
                                _id: {
                                    $toString: '$$this._id'
                                },
                                username: '$$this.username',
                                name: '$$this.name'
                            }
                        }
                    }
                }
            }
        ]);
        console.log(socket.handshake.auth.userId + 'line 6 home.listener');
        console.log(userInfo + 'line 13 home.listener');
        console.log(user + 'line 58 home.listener');
        return user[0].friends.filter(friend => io.sockets.adapter.rooms.has(friend.username));
    }
};
