const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_studio";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Generates a JSON Web Token for the user session.
 */
const generateToken = (user) => {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
};

// 1. POST /api/auth/register (Local Signup)
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // Check duplicate email
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ error: "Email is already registered." });
    }

    // Check duplicate username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ error: "Username is already taken." });
    }

    // Create avatar using a high-quality initials SVG avatar generator
    const initialsAvatar = `https://avatar.iran.liara.run/username?username=${encodeURIComponent(username)}`;

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      avatar: initialsAvatar,
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Local register error:", err);
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

// 2. POST /api/auth/login (Local Credentials Sign-in)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user);
    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Local login error:", err);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

// 3. POST /api/auth/google (Google Federated OAuth Sign-in)
router.post("/google", async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Google credential token is required." });
  }

  try {
    // Verify credential ID token from client
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: "Google account does not provide an email." });
    }

    // Look for matching user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      // Update account details if Google sign-in was connected later
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = googleId;
        needsSave = true;
      }
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    } else {
      // Register new user automatically
      // Ensure unique username if Google name is taken
      let baseUsername = name.replace(/\s+/g, "").slice(0, 15);
      let username = baseUsername;
      let suffix = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      user = await User.create({
        username,
        email: email.toLowerCase(),
        avatar: picture || `https://avatar.iran.liara.run/username?username=${encodeURIComponent(username)}`,
        googleId,
      });
    }

    const token = generateToken(user);
    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(400).json({ error: "Google authentication failed. Invalid token." });
  }
});

// 4. GET /api/auth/me (Current User Profile Retrieval)
router.get("/me", authMiddleware, async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      avatar: req.user.avatar,
      createdAt: req.user.createdAt,
    },
  });
});

module.exports = router;
