import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  DASHBOARD_ACCESS_BY_ROLE,
  type DashboardAccess,
  type DashboardPageKey,
  type DashboardRole,
  type SelfServeSignupInput,
} from "@openseat/domain";

const TOKEN_KEY = "openseat_token";
const ROLE_KEY = "openseat_role";
const RESTAURANT_KEY = "openseat_restaurant";
const DASHBOARD_ACCESS_KEY = "openseat_dashboard_access";
const API = "/api/v1";

export type AuthRole = DashboardRole;

export interface AuthRestaurant {
  id: string;
  name: string;
}

interface LoginResult {
  role: AuthRole;
  restaurant: AuthRestaurant | null;
  dashboardAccess: DashboardAccess;
}

interface AuthApiResponse extends LoginResult {
  token: string;
}

interface AuthContextValue {
  token: string | null;
  role: AuthRole | null;
  restaurant: AuthRestaurant | null;
  dashboardAccess: DashboardAccess;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isRestaurantAdmin: boolean;
  isEmployee: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (payload: SelfServeSignupInput) => Promise<LoginResult>;
  logout: () => void;
  switchRestaurant: (restaurant: AuthRestaurant | null) => void;
  canAccess: (page: DashboardPageKey) => boolean;
  canDo: (action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_ACCESS: DashboardAccess = { pages: [], actions: [] };
const DASHBOARD_PAGE_KEYS: DashboardPageKey[] = [
  "restaurants",
  "today",
  "reservations",
  "waitlist",
  "loyalty",
  "guests",
  "settings",
  "help",
];


function loadStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeRole(value: string | null): AuthRole | null {
  return value === "admin" || value === "employee" || value === "super_admin" ? value : null;
}

function normalizeDashboardAccess(raw: unknown, role: AuthRole | null): DashboardAccess {
  const fallback = role ? DASHBOARD_ACCESS_BY_ROLE[role] : EMPTY_ACCESS;
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as { pages?: unknown; actions?: unknown };
  const pages = Array.isArray(candidate.pages)
    ? candidate.pages.filter(
        (page): page is DashboardPageKey =>
          typeof page === "string"
          && DASHBOARD_PAGE_KEYS.includes(page as DashboardPageKey)
          && fallback.pages.includes(page as DashboardPageKey),
      )
    : fallback.pages;
  const actions = Array.isArray(candidate.actions)
    ? candidate.actions.filter(
        (action): action is string =>
          typeof action === "string" && fallback.actions.includes(action),
      )
    : fallback.actions;

  return { pages, actions };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [role, setRole] = useState<AuthRole | null>(() => normalizeRole(localStorage.getItem(ROLE_KEY)));
  const [restaurant, setRestaurant] = useState<AuthRestaurant | null>(
    () => loadStored<AuthRestaurant>(RESTAURANT_KEY),
  );
  const [dashboardAccess, setDashboardAccess] = useState<DashboardAccess>(() =>
    normalizeDashboardAccess(loadStored(DASHBOARD_ACCESS_KEY), normalizeRole(localStorage.getItem(ROLE_KEY))),
  );

  const isAuthenticated = !!token;
  const isSuperAdmin = role === "super_admin";
  const isRestaurantAdmin = role === "admin" || role === "super_admin";
  const isEmployee = role === "employee";

  const canAccess = useCallback(
    (page: DashboardPageKey) => dashboardAccess.pages.includes(page),
    [dashboardAccess],
  );

  const canDo = useCallback(
    (action: string) => dashboardAccess.actions.includes(action),
    [dashboardAccess],
  );

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
    localStorage.removeItem(DASHBOARD_ACCESS_KEY);
    setToken(null);
    setRole(null);
    setRestaurant(null);
    setDashboardAccess(EMPTY_ACCESS);
    window.location.href = "/login";
  }, []);

  const persistAuthResponse = useCallback((data: AuthApiResponse) => {
    const newRole = normalizeRole(data.role) ?? "admin";
    const newRestaurant = data.restaurant ?? null;
    const newDashboardAccess = normalizeDashboardAccess(data.dashboardAccess, newRole);

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ROLE_KEY, newRole);
    localStorage.setItem(DASHBOARD_ACCESS_KEY, JSON.stringify(newDashboardAccess));
    setToken(data.token);
    setRole(newRole);
    setDashboardAccess(newDashboardAccess);

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
      dashboardAccess: newDashboardAccess,
    } satisfies LoginResult;
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

    const data = await res.json() as AuthApiResponse;
    return persistAuthResponse(data);
  }, [persistAuthResponse]);

  const signup = useCallback(async (payload: SelfServeSignupInput) => {
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const apiError = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(apiError?.error ?? `API error: ${res.status}`);
    }

    const data = await res.json() as AuthApiResponse;
    return persistAuthResponse(data);
  }, [persistAuthResponse]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        setToken(e.newValue);
      }
      if (e.key === ROLE_KEY) {
        const newRole = normalizeRole(e.newValue);
        setRole(newRole);
        if (!newRole) {
          setDashboardAccess(EMPTY_ACCESS);
        }
      }
      if (e.key === RESTAURANT_KEY) {
        setRestaurant(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === DASHBOARD_ACCESS_KEY || e.key === ROLE_KEY) {
        const nextRole = normalizeRole(e.key === ROLE_KEY ? e.newValue : localStorage.getItem(ROLE_KEY));
        const nextAccess = e.key === DASHBOARD_ACCESS_KEY
          ? (e.newValue ? JSON.parse(e.newValue) : null)
          : loadStored(DASHBOARD_ACCESS_KEY);
        setDashboardAccess(normalizeDashboardAccess(nextAccess, nextRole));
      }
      if (e.key === TOKEN_KEY && !e.newValue) {
        setRole(null);
        setRestaurant(null);
        setDashboardAccess(EMPTY_ACCESS);
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
        dashboardAccess,
        isAuthenticated,
        isSuperAdmin,
        isRestaurantAdmin,
        isEmployee,
        login,
        signup,
        logout,
        switchRestaurant,
        canAccess,
        canDo,
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
