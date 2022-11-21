const User = require("../models/user.model");

module.exports = {
  async getStatisticalUser(req, res, next) {
    const sum = await User.count({});
    res.json({ sum });
  },
};
