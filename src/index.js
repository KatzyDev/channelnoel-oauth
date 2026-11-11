const crypto = require("node:crypto");

class ChannelNoelOAuthError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ChannelNoelOAuthError";
    this.status = options.status || 500;
    this.data = options.data;
  }
}

function createPKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

class ChannelNoelOAuth {
  constructor(options = {}) {
    const {
      baseURL,
      clientId,
      clientSecret,
      redirectURI,
      fetchImpl = globalThis.fetch
    } = options;

    if (!baseURL || !clientId || !clientSecret || !redirectURI) {
      throw new TypeError("baseURL, clientId, clientSecret et redirectURI sont obligatoires.");
    }
    if (typeof fetchImpl !== "function") {
      throw new TypeError("Node.js 18+ ou un fetchImpl compatible est nécessaire.");
    }

    this.baseURL = new URL(baseURL);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectURI = redirectURI;
    this.fetch = fetchImpl;
  }

  createAuthorizationRequest({ state, verifier } = {}) {
    const oauthState = state || crypto.randomBytes(32).toString("hex");
    const pkce = verifier
      ? {
          verifier,
          challenge: crypto.createHash("sha256").update(verifier).digest("base64url")
        }
      : createPKCE();

    const url = new URL("/oauth/connect.php", this.baseURL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectURI);
    url.searchParams.set("state", oauthState);
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return { url: url.toString(), state: oauthState, codeVerifier: pkce.verifier };
  }

  async exchangeCode({ code, codeVerifier }) {
    if (!code || !codeVerifier) {
      throw new TypeError("code et codeVerifier sont obligatoires.");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectURI,
      code_verifier: codeVerifier
    });

    const response = await this.fetch(new URL("/oauth/token.php", this.baseURL), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body
    });

    const data = await this.#readJSON(response, "Échec de récupération du token.");
    if (!response.ok) {
      throw new ChannelNoelOAuthError("ChannelNoel a refusé l'échange du code.", {
        status: response.status,
        data
      });
    }

    const accessToken = data.access_token || data.token;
    if (!accessToken) {
      throw new ChannelNoelOAuthError("Aucun access_token/token dans la réponse ChannelNoel.", {
        status: 502,
        data
      });
    }

    return { ...data, access_token: accessToken };
  }

  async getUser(accessToken) {
    if (!accessToken) throw new TypeError("accessToken est obligatoire.");

    const response = await this.fetch(new URL("/oauth/me.php", this.baseURL), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });

    const data = await this.#readJSON(response, "Impossible de lire le profil ChannelNoel.");
    if (!response.ok) {
      throw new ChannelNoelOAuthError("La récupération du profil a échoué.", {
        status: response.status,
        data
      });
    }
    return data.user || data;
  }

  async revokeToken(accessToken) {
    if (!accessToken) return false;

    const response = await this.fetch(new URL("/oauth/revoke.php", this.baseURL), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new ChannelNoelOAuthError("La révocation du token a échoué.", {
        status: response.status
      });
    }
    return true;
  }

  async #readJSON(response, message) {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ChannelNoelOAuthError(`${message} Réponse non JSON reçue.`, {
        status: 502,
        data: text.slice(0, 500)
      });
    }
    return data;
  }
}

module.exports = { ChannelNoelOAuth, ChannelNoelOAuthError, createPKCE };