const isClient = () => typeof window !== "undefined";

export const tokenStore = {
  get accessToken() {
    return isClient() ? localStorage.getItem("accessToken") : null;
  },
  set accessToken(value: string | null) {
    if (!isClient()) return;
    if (value) localStorage.setItem("accessToken", value);
    else localStorage.removeItem("accessToken");
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
  },
};
