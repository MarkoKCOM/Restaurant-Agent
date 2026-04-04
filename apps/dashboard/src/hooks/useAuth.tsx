import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

const TOKEN_KEY = "sable_token";
const RESTAURANT_KEY = "sable_restaurant";
const API = "/api/v1";

interface AuthRestaurant {
  id: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  restaurant: AuthRestaurant | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );
  const [restaurant, setRestaurant] = useState<AuthRestaurant | null>(
    () => loadStored<AuthRestaurant>(RESTAURANT_KEY),
  );

  const isAuthenticated = !!token;

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RESTAURANT_KEY);
    setToken(null);
    setRestaurant(null);
    // Redirect handled by ProtectedRoute or caller
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
    const newRestaurant = data.restaurant as AuthRestaurant;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(RESTAURANT_KEY, JSON.stringify(newRestaurant));
    setToken(newToken);
    setRestaurant(newRestaurant);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        setToken(e.newValue);
        if (!e.newValue) {
          setRestaurant(null);
        }
      }
      if (e.key === RESTAURANT_KEY) {
        setRestaurant(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, restaurant, isAuthenticated, login, logout }}
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
