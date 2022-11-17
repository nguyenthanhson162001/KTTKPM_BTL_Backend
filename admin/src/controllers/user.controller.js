const User = require("../models/user.model");

module.exports = {
 
  async disableAdmin(req, res, next) {
    const email = req.params.email;
    let user = await User.findOne({ email: email });
    if (!user) {
      return res.json({
        sucsess: false,
        message: "email not found",
      });
    }
    if (!user.auth.isAdmin) {
      return res.json({
        sucsess: false,
        message: "the user not is an administrator",
      });
    }
    await User.update({ email: email }, { "auth.isAdmin": false });
    return res.json({
      sucsess: true,
      message: `disable admin for user ${email} success`,
    });
  },
  async getStatisticalUser(req, res, next) {
    const sum = await User.count({});
    res.json({ sum });
  },
  async setAdmin(req, res, next) {
    const email = req.params.email;
    let user = await User.findOne({ email: email });
    if (!user) {
      return res.json({
        sucsess: false,
        message: "email not found",
      });
    }
    if (user.auth.isAdmin) {
      return res.json({
        sucsess: false,
        message: "the user is already an administrator",
      });
    }
    await User.update({ _id: user._id.toString() }, { "auth.isAdmin": true });
    return res.json({
      sucsess: true,
      message: `set admin for user ${email} success`,
    });
  },
};
