const crypto = require("node:crypto");
const { ChannelNoelOAuth } = require("./index");

function createChannelNoelRouter(options = {}) {
  const {
    oauth,
    baseURL,
    clientId,
    clientSecret,
    redirectURI,
    loginPath = "/auth/channelnoel",
    callbackPath = "/callback",
    logoutPath = "/logout",
    homePath = "/",
    sessionUserKey = "user",
    sessionTokenKey = "accessToken",
    sessionStateKey = "channelNoelOAuthState",
    sessionVerifierKey = "channelNoelCodeVerifier",
    cookieName = "connect.sid",
    onError
  } = options;

  const client = oauth || new ChannelNoelOAuth({
    baseURL, clientId, clientSecret, redirectURI
  });

  // lazy require
  const express = require("express");
  const router = express.Router();

  router.get(loginPath, (req, res, next) => {
    if (!req.session) return next(new Error("express-session doit être installé avant le routeur OAuth."));

    const state = crypto.randomBytes(32).toString("hex");
    const request = client.createAuthorizationRequest({ state });
    req.session[sessionStateKey] = request.state;
    req.session[sessionVerifierKey] = request.codeVerifier;
    res.redirect(request.url);
  });

  router.get(callbackPath, async (req, res, next) => {
    try {
      const { code, state, error } = req.query;
      if (error) return res.status(400).send("Connexion refusée par ChannelNoel.");

      const expectedState = req.session && req.session[sessionStateKey];
      const verifier = req.session && req.session[sessionVerifierKey];

      if (!code || !state || !expectedState || !verifier) {
        return res.status(400).send("Paramètres OAuth manquants ou session expirée.");
      }

      const received = String(state);
      const expected = String(expectedState);
      const validState = received.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));

      if (!validState) return res.status(400).send("La vérification OAuth state a échoué.");

      delete req.session[sessionStateKey];
      delete req.session[sessionVerifierKey];

      const tokenData = await client.exchangeCode({
        code: String(code),
        codeVerifier: verifier
      });
      const accessToken = tokenData.access_token;
      const user = await client.getUser(accessToken);

      // Empêche la fixation de session après authentification.
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => err ? reject(err) : resolve());
      });

      req.session[sessionUserKey] = user;
      req.session[sessionTokenKey] = accessToken;
      res.redirect(homePath);
    } catch (err) {
      if (onError) onError(err, req, res);
      if (res.headersSent) return;
      if (typeof next === "function" && !onError) return next(err);
      res.status(err.status || 500).send("Une erreur est survenue pendant l'authentification ChannelNoel.");
    }
  });

  router.post(logoutPath, async (req, res, next) => {
    try {
      const token = req.session && req.session[sessionTokenKey];
      if (token) {
        try {
          await client.revokeToken(token);
        } catch (err) {
          // la session locale sera quand même détruite.
          if (onError) onError(err, req, res);
        }
      }

      if (!req.session) {
        res.clearCookie(cookieName);
        return res.redirect(homePath);
      }

      await new Promise((resolve, reject) => {
        req.session.destroy(err => err ? reject(err) : resolve());
      });
      res.clearCookie(cookieName);
      res.redirect(homePath);
    } catch (err) {
      if (typeof next === "function") return next(err);
      res.status(500).send("Erreur lors de la déconnexion.");
    }
  });

  return router;
}

module.exports = { createChannelNoelRouter };