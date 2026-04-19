import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuests } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import { useLang } from "../i18n.js";
import type { Guest } from "@openseat/domain";

export function GuestsPage() {
  const { restaurant } = useCurrentRestaurant();
  const { data: guests, isLoading } = useGuests(restaurant?.id);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const dir = lang === "he" ? "text-right" : "text-left";

  const filtered = search
    ? guests?.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.phone.includes(search),
      )
    : guests;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t.guests.title}</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.guests.search}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500">{t.res.loading}</div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">{t.guests.noResults}</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.guests.name}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.guests.phone}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.guests.visits}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.guests.tier}</th>
                  <th className={`${dir} px-4 py-3 font-medium text-gray-500`}>{t.guests.tags}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g: Guest) => (
                  <tr
                    key={g.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/guests/${g.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{g.phone}</td>
                    <td className="px-4 py-3">{g.visitCount}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        {g.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {g.tags?.map((tag) => (
                        <span key={tag} className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 ml-1">{tag}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((g: Guest) => (
                <div
                  key={g.id}
                  className="p-4 cursor-pointer active:bg-gray-50"
                  onClick={() => navigate(`/guests/${g.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{g.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{g.tier}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-mono">{g.phone}</span>
                    <span>{g.visitCount} {t.guests.visits}</span>
                  </div>
                  {g.tags && g.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {g.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
