import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useLang } from "../i18n.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      navigate(result.role === "super_admin" ? "/restaurants" : "/today", { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
        setError(t.login.errorInvalid);
      } else {
        setError(t.login.errorGeneral);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir={lang === "he" ? "rtl" : "ltr"}
      className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative"
    >
      {/* Language toggle */}
      <button
        type="button"
        onClick={() => setLang(lang === "he" ? "en" : "he")}
        className="absolute top-4 right-4 px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {lang === "he" ? "EN" : "עב"}
      </button>

      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Branding */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">OpenSeat</h1>
            <p className="text-sm text-gray-500 mt-1">{t.nav.subtitle}</p>
          </div>

          <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
            {t.login.title}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.login.email}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                dir="ltr"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.login.password}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                dir="ltr"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? "..." : t.login.submit}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-center">
            <p className="text-sm font-medium text-gray-800">{t.login.newRestaurantTitle}</p>
            <p className="mt-1 text-sm text-gray-600">{t.login.newRestaurantBody}</p>
            <Link
              to="/signup"
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              {t.login.signupCta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
