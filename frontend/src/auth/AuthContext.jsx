import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.currentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch((error) => {
        if (!cancelled) setStatusError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    statusError,
    async login(identifier, password) {
      const authenticatedUser = await api.login(identifier, password);
      setUser(authenticatedUser);
      setStatusError("");
      return authenticatedUser;
    },
    async register(username, email, password) {
      const authenticatedUser = await api.register(username, email, password);
      setUser(authenticatedUser);
      setStatusError("");
      return authenticatedUser;
    },
    async logout() {
      await api.logout();
      setUser(null);
    },
  }), [user, loading, statusError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
