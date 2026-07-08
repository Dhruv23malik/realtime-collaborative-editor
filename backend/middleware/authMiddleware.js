const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * JWT Verification Middleware
 * Protects route endpoints by ensuring a valid Bearer JWT is attached in request headers.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. Authorization token required." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key_studio");

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "Access denied. User session invalid." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Access denied. Invalid or expired session token." });
  }
};

module.exports = authMiddleware;
