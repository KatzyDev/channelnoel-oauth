# channelnoel-oauth

Client OAuth 2.0 de ChannelNoel avec PKCE (S256), échange du code, lecture du profil et révocation du token. Inclut une intégration Express optionnelle.

## Prérequis

- Node.js 18 ou supérieur (`fetch` natif)
- Pour l'intégration Express : `express` et `express-session`

## Installation

```bash
npm install channelnoel-oauth
npm install express express-session dotenv
```

## Intégration Express rapide

Configure d'abord `express-session`, puis monte le routeur :

```js
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
    secure: true, // en production HTTPS
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(createChannelNoelRouter({
  baseURL: process.env.CHANNELNOEL_BASE_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectURI: process.env.REDIRECT_URI,
  cookieName: "channelnoel.sid"
}));

app.listen(3000);
```

Le routeur ajoute par défaut :

| Méthode | Route | Fonction |
|---|---|---|
| GET | `/auth/channelnoel` | Démarre OAuth et redirige vers ChannelNoel |
| GET | `/callback` | Vérifie `state`, échange le code et charge le profil |
| POST | `/logout` | Révoque le token puis détruit la session |

Après connexion, les données sont disponibles dans `req.session.user` et `req.session.accessToken`.

### Options du routeur

- `loginPath`, `callbackPath`, `logoutPath`, `homePath`
- `sessionUserKey`, `sessionTokenKey`
- `sessionStateKey`, `sessionVerifierKey`
- `cookieName` (doit correspondre au `name` de `express-session`)
- `onError(error, req, res)`

Le `redirectURI` déclaré dans la configuration doit correspondre exactement à l'URL de callback enregistrée dans l'application ChannelNoel.

## Utilisation sans Express

```js
const { ChannelNoelOAuth } = require("channelnoel-oauth");

const oauth = new ChannelNoelOAuth({
  baseURL: process.env.CHANNELNOEL_BASE_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectURI: process.env.REDIRECT_URI
});

// À l'étape de connexion : stocker state et codeVerifier côté serveur,
// liés à la session de l'utilisateur.
const auth = oauth.createAuthorizationRequest();
console.log(auth.url);
// Conserver auth.state et auth.codeVerifier de façon temporaire et sûre.

// Dans la route callback, après validation de state :
const token = await oauth.exchangeCode({
  code: req.query.code,
  codeVerifier: savedCodeVerifier
});
const user = await oauth.getUser(token.access_token);

// À la déconnexion :
await oauth.revokeToken(token.access_token);
```

## Sécurité et notes

- Le `state` et le vérificateur PKCE sont stockés dans la session serveur dans l'intégration Express.
- Le `state` est comparé en temps constant et la session est régénérée après connexion.
- Ne stocke jamais `clientSecret` dans le navigateur et ne l'expose pas dans le frontend.
- En production, utilise HTTPS, un secret de session robuste et un vrai store de sessions (Redis, base de données, etc.) plutôt que le `MemoryStore` par défaut d'`express-session`.
- Si ton application est derrière un proxy HTTPS, configure correctement `trust proxy`.
- Le routeur utilise les endpoints fournis : `/oauth/connect.php`, `/oauth/token.php`, `/oauth/me.php` et `/oauth/revoke.php`.

## Licence

The MIT License (MIT)
=====================

Copyright © `2026` `DigitalNyan`

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

