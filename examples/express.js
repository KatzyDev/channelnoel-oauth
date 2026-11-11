require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { createChannelNoelRouter } = require("channelnoel-oauth/express");

const app = express();
app.set("trust proxy", 1);

app.use(session({
  name: "channelnoel.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(createChannelNoelRouter({
  baseURL: process.env.CHANNELNOEL_BASE_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectURI: process.env.REDIRECT_URI,
  cookieName: "channelnoel.sid",
  homePath: "/"
}));

app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.send('<a href="/auth/channelnoel">Se connecter avec ChannelNoel</a>');
  }
  res.json({ user: req.session.user });
});

app.listen(process.env.PORT || 3000);