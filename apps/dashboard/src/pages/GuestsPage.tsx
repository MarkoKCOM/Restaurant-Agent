import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuests } from "../hooks/api.js";
import { useCurrentRestaurant } from "../hooks/useCurrentRestaurant.js";
import type { Guest } from "@sable/domain";

export function GuestsPage() {
  const { restaurant } = useCurrentRestaurant();
  const { data: guests, isLoading } = useGuests(restaurant?.id);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = search
    ? guests?.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.phone.includes(search),
      )
    : guests;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">אורחים</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או טלפון..."
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-64"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">שם</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">טלפון</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">ביקורים</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">דרג</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">תגיות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  טוען...
                </td>
              </tr>
            ) : !filtered || filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  אין אורחים רשומים עדיין
                </td>
              </tr>
            ) : (
              filtered.map((g: Guest) => (
                <tr
                  key={g.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/guests/${g.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{g.phone}</td>
                  <td className="px-4 py-3">{g.visitCount}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      {g.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {g.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 ml-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
