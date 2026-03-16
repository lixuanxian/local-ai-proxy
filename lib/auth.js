const config = require("./config");

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(";").forEach(pair => {
    const [key, ...vals] = pair.trim().split("=");
    if (key) cookies[key.trim()] = vals.join("=").trim();
  });
  return cookies;
}

function requireAuth(req, res, next) {
  const authEnabled = config.getSetting("auth_enabled");
  if (!authEnabled || authEnabled === "false") return next();

  const cookies = parseCookies(req.headers.cookie || "");
  const sessionToken = cookies["session"];

  if (!sessionToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = config.getSessionByToken(sessionToken);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.user = { id: session.user_id, username: session.username, role: session.role };
  next();
}

module.exports = { requireAuth, parseCookies };
