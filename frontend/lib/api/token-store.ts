const isClient = () => typeof window !== "undefined";

const accessTokenListeners = new Set<() => void>();

function notifyAccessTokenChanged() {
  accessTokenListeners.forEach((listener) => listener());
}

export const tokenStore = {
  get accessToken() {
    return isClient() ? localStorage.getItem("accessToken") : null;
  },
  set accessToken(value: string | null) {
    if (!isClient()) return;
    if (value) localStorage.setItem("accessToken", value);
    else localStorage.removeItem("accessToken");
    notifyAccessTokenChanged();
  },
  get refreshToken() {
    return isClient() ? localStorage.getItem("refreshToken") : null;
  },
  set refreshToken(value: string | null) {
    if (!isClient()) return;
    if (value) localStorage.setItem("refreshToken", value);
    else localStorage.removeItem("refreshToken");
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
    if (!isClient()) return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    notifyAccessTokenChanged();
  },
  subscribeAccessToken(listener: () => void) {
    accessTokenListeners.add(listener);
    return () => accessTokenListeners.delete(listener);
  },
};
