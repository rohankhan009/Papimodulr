import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null); // null = checking, false = logged out, object = logged in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ti_admin_token");
    if (!token) {
      setAdmin(false);
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setAdmin(res.data))
      .catch(() => {
        localStorage.removeItem("ti_admin_token");
        setAdmin(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("ti_admin_token", res.data.token);
    setAdmin(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("ti_admin_token");
    setAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
