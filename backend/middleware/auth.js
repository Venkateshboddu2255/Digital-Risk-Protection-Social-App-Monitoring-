import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.cookies?.brandshield_session;
  if (!token) return res.status(401).json({ success: false, message: "Please log in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    next();
  } catch {
    res.clearCookie("brandshield_session", cookieOptions());
    return res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }
    next();
  };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}
