import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("jtg_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setUser(res.data.user);
        setLoading(false);
      }).catch((err) => {
        if (err.response?.status === 401) {
          setToken(null);
          localStorage.removeItem("jtg_token");
          setUser(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Request interceptor: ONLY attach Authorization header for internal endpoints (/api/ or relative)
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const url = config.url || "";
      const isInternal = url.startsWith("/api/") || (!url.startsWith("http://") && !url.startsWith("https://"));
      const storedToken = localStorage.getItem("jtg_token");
      
      if (isInternal && storedToken) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${storedToken}`;
      } else if (!isInternal && config.headers) {
        // Strip authorization for external third-party APIs
        delete config.headers["Authorization"];
        delete config.headers["authorization"];
      }
      return config;
    });

    // Response interceptor: ONLY redirect/logout on 401 if it came from our internal backend API
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = error.config?.url || "";
        const isInternal = url.startsWith("/api/") || (!url.startsWith("http://") && !url.startsWith("https://"));
        const isAuthEndpoint = url.includes("/api/auth/login") || url.includes("/api/auth/register");
        
        // If our internal API rejected the session as 401 Unauthorized (and not login failure)
        if (error.response?.status === 401 && isInternal && !isAuthEndpoint) {
          setToken(null);
          setUser(null);
          localStorage.removeItem("jtg_token");
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  const login = (token: string, user: any) => {
    setToken(token);
    setUser(user);
    localStorage.setItem("jtg_token", token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("jtg_token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get("/api/auth/me");
      setUser(res.data.user);
    } catch (e) {
      // ignore
    }
  };

  const updateUser = (updatedFields: any) => {
    setUser((prev: any) => (prev ? { ...prev, ...updatedFields } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
