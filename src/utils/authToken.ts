interface JwtPayload {
  exp?: number;
}

const decodeBase64Url = (value: string) => {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalizedValue.length % 4;
  const paddedValue = padding === 0 ? normalizedValue : normalizedValue.padEnd(normalizedValue.length + (4 - padding), "=");

  return window.atob(paddedValue);
};

export const parseTokenPayload = (token: string | null) => {
  if (!token) {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(segments[1])) as JwtPayload;
  } catch {
    return null;
  }
};

export const getTokenExpiryTime = (token: string | null) => {
  const payload = parseTokenPayload(token);

  if (!payload?.exp || !Number.isFinite(payload.exp)) {
    return null;
  }

  return payload.exp * 1000;
};

export const isTokenExpired = (token: string | null, now = Date.now()) => {
  const expiryTime = getTokenExpiryTime(token);

  if (!expiryTime) {
    return true;
  }

  return expiryTime <= now;
};

export const getTokenExpiryDelay = (token: string | null, now = Date.now()) => {
  const expiryTime = getTokenExpiryTime(token);

  if (!expiryTime) {
    return 0;
  }

  return Math.max(0, expiryTime - now);
};
