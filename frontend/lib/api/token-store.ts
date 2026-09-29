const isClient = () => typeof window !== "undefined";

const accessTokenListeners = new Set<() => void>();
let inMemoryAccessToken: string | null = null;

function notifyAccessTokenChanged() {
  accessTokenListeners.forEach((listener) => listener());
}

export const tokenStore = {
  get accessToken() {
    return inMemoryAccessToken;
  },
  set accessToken(value: string | null) {
    inMemoryAccessToken = value;
    notifyAccessTokenChanged();
  },
  getUser<T>() {
    if (!isClient()) return null;
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setUser<T>(value: T | null) {
    if (!isClient()) return;
    if (value) localStorage.setItem("user", JSON.stringify(value));
    else localStorage.removeItem("user");
  },
  clear() {
    inMemoryAccessToken = null;
    if (isClient()) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
    notifyAccessTokenChanged();
  },
  clearLegacyTokens() {
    if (!isClient()) return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
  subscribeAccessToken(listener: () => void) {
    accessTokenListeners.add(listener);
    return () => accessTokenListeners.delete(listener);
  },
};
