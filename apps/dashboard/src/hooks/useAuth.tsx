import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

const TOKEN_KEY = "openseat_token";
const ROLE_KEY = "openseat_role";
const RESTAURANT_KEY = "openseat_restaurant";
const API = "/api/v1";

export type AuthRole = "admin" | "super_admin";

export interface AuthRestaurant {
  id: string;
  name: string;
}

interface LoginResult {
  role: AuthRole;
  restaurant: AuthRestaurant | null;
}

interface AuthContextValue {
  token: string | null;
  role: AuthRole | null;
  restaurant: AuthRestaurant | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  switchRestaurant: (restaurant: AuthRestaurant | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [role, setRole] = useState<AuthRole | null>(() => {
    const stored = localStorage.getItem(ROLE_KEY);
    return stored === "admin" || stored === "super_admin" ? stored : null;
  });
  const [restaurant, setRestaurant] = useState<AuthRestaurant | null>(
    () => loadStored<AuthRestaurant>(RESTAURANT_KEY),
  );

  const isAuthenticated = !!token;
  const isSuperAdmin = role === "super_admin";

  const switchRestaurant = useCallback((nextRestaurant: AuthRestaurant | null) => {
    if (!nextRestaurant) {
      localStorage.removeItem(RESTAURANT_KEY);
      setRestaurant(null);
      return;
    }

    localStorage.setItem(RESTAURANT_KEY, JSON.stringify(nextRestaurant));
    setRestaurant(nextRestaurant);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(RESTAURANT_KEY);
    setToken(null);
    setRole(null);
    setRestaurant(null);
    window.location.href = "/login";
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("INVALID_CREDENTIALS");
      }
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    const newToken = data.token as string;
    const newRole = (data.role as AuthRole | undefined) ?? "admin";
    const newRestaurant = (data.restaurant as AuthRestaurant | null | undefined) ?? null;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ROLE_KEY, newRole);
    setToken(newToken);
    setRole(newRole);

    if (newRole === "super_admin") {
      localStorage.removeItem(RESTAURANT_KEY);
      setRestaurant(null);
    } else if (newRestaurant) {
      localStorage.setItem(RESTAURANT_KEY, JSON.stringify(newRestaurant));
      setRestaurant(newRestaurant);
    } else {
      localStorage.removeItem(RESTAURANT_KEY);
      setRestaurant(null);
    }

    return {
      role: newRole,
      restaurant: newRole === "super_admin" ? null : newRestaurant,
    } satisfies LoginResult;
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        setToken(e.newValue);
      }
      if (e.key === ROLE_KEY) {
        setRole(e.newValue === "admin" || e.newValue === "super_admin" ? e.newValue : null);
      }
      if (e.key === RESTAURANT_KEY) {
        setRestaurant(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === TOKEN_KEY && !e.newValue) {
        setRole(null);
        setRestaurant(null);
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        restaurant,
        isAuthenticated,
        isSuperAdmin,
        login,
        logout,
        switchRestaurant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
