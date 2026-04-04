import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuest, useUpdateGuest, useLoyaltyBalance, useLoyaltyHistory, useVisitInsights } from "../hooks/api.js";
import type { LoyaltyTransaction } from "../hooks/api.js";
import { useToast } from "../components/Toast.js";
import type { Reservation } from "@sable/domain";

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  seated: "יושב",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיע",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-red-100 text-red-800",
};

const TIER_LABELS: Record<string, string> = {
  bronze: "ברונזה",
  silver: "כסף",
  gold: "זהב",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-orange-100 text-orange-700 border-orange-200",
  silver: "bg-gray-200 text-gray-700 border-gray-300",
  gold: "bg-amber-100 text-amber-700 border-amber-200",
};

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGuest(id);
  const updateGuestMutation = useUpdateGuest();
  const { data: loyaltyBalance } = useLoyaltyBalance(id);
  const { data: loyaltyHistory } = useLoyaltyHistory(id);
  const { data: visitInsights } = useVisitInsights(id);
  const { showToast } = useToast();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [newTag, setNewTag] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        טוען...
      </div>
    );
  }

  if (!data?.guest) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        אורח לא נמצא
      </div>
    );
  }

  const { guest, reservations } = data;

  function startEditNotes() {
    setNotesValue(guest.notes ?? "");
    setEditingNotes(true);
  }

  function saveNotes() {
    if (!id) return;
    updateGuestMutation.mutate(
      { id, data: { notes: notesValue } },
      {
        onSuccess: () => {
          setEditingNotes(false);
          showToast("ההערות נשמרו");
        },
        onError: () => showToast("שגיאה בשמירת ההערות", "error"),
      },
    );
  }

  function addTag() {
    if (!id || !newTag.trim()) return;
    const currentTags = guest.tags ?? [];
    const tag = newTag.trim();
    if (currentTags.includes(tag)) {
      setNewTag("");
      return;
    }
    updateGuestMutation.mutate(
      { id, data: { tags: [...currentTags, tag] } },
      {
        onSuccess: () => {
          setNewTag("");
          showToast("התגית נוספה");
        },
        onError: () => showToast("שגיאה בהוספת תגית", "error"),
      },
    );
  }

  function removeTag(tag: string) {
    if (!id) return;
    const currentTags = guest.tags ?? [];
    updateGuestMutation.mutate(
      { id, data: { tags: currentTags.filter((t) => t !== tag) } },
      {
        onSuccess: () => showToast("התגית הוסרה"),
        onError: () => showToast("שגיאה בהסרת תגית", "error"),
      },
    );
  }

  // Determine which tags are "auto" vs "manual"
  // Convention: auto-tags start with "auto:" prefix or are system-generated common patterns
  const AUTO_TAG_PREFIXES = ["auto:", "vip", "regular", "new"];
  function isAutoTag(tag: string): boolean {
    const lower = tag.toLowerCase();
    return AUTO_TAG_PREFIXES.some((p) => lower.startsWith(p));
  }

  return (
    <div>
      {/* Back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/guests")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; חזרה לאורחים
        </button>
      </div>

      {/* Guest info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{guest.name}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="font-mono">{guest.phone}</span>
              {guest.email && <span>{guest.email}</span>}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${TIER_COLORS[guest.tier] ?? "bg-gray-100"}`}
          >
            {TIER_LABELS[guest.tier] ?? guest.tier}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-600 font-medium">ביקורים</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{guest.visitCount}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600 font-medium">לא הגיע</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{guest.noShowCount}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600 font-medium">מקור</p>
            <p className="text-lg font-bold text-gray-700 mt-1">{guest.source}</p>
          </div>
        </div>
      </div>

      {/* Loyalty Section */}
      {loyaltyBalance && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">נאמנות</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-sm text-amber-600 font-medium">נקודות</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{loyaltyBalance.points}</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-sm text-purple-600 font-medium">דרגה</p>
              <p className={`text-lg font-bold mt-1 ${
                loyaltyBalance.tier === "gold" ? "text-amber-600" :
                loyaltyBalance.tier === "silver" ? "text-gray-600" :
                "text-orange-600"
              }`}>
                {TIER_LABELS[loyaltyBalance.tier] ?? loyaltyBalance.tier}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm text-green-600 font-medium">הטבות שנצברו</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{loyaltyBalance.stampCard.earned}</p>
            </div>
          </div>

          {/* Stamp card progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">כרטיס חותמות</span>
              <span className="text-xs text-gray-500">
                {loyaltyBalance.stampCard.visits} / {loyaltyBalance.stampCard.stampsNeeded}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-amber-500 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (loyaltyBalance.stampCard.visits / Math.max(1, loyaltyBalance.stampCard.stampsNeeded)) * 100)}%`,
                }}
              />
            </div>
            {loyaltyBalance.stampCard.stampsUntilReward > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                עוד {loyaltyBalance.stampCard.stampsUntilReward} ביקורים להטבה הבאה
              </p>
            )}
          </div>

          {/* Recent transactions */}
          {loyaltyHistory?.transactions && loyaltyHistory.transactions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">פעולות אחרונות</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {loyaltyHistory.transactions.slice(0, 10).map((tx: LoyaltyTransaction) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-gray-700">{tx.description}</span>
                      <span className="text-xs text-gray-400 mr-2">
                        {new Date(tx.createdAt).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <span className={`font-mono font-medium ${tx.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.points >= 0 ? "+" : ""}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tags Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">תגיות</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {(!guest.tags || guest.tags.length === 0) && (
            <p className="text-gray-400 text-sm">אין תגיות</p>
          )}
          {(guest.tags ?? []).map((tag) => {
            const auto = isAutoTag(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  auto
                    ? "bg-gray-100 text-gray-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {tag}
                {!auto && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-600 transition-colors"
                    title="הסר תגית"
                  >
                    &times;
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="תגית חדשה..."
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim() || updateGuestMutation.isPending}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            הוסף
          </button>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">הערות</h3>
          {!editingNotes && (
            <button
              onClick={startEditNotes}
              className="text-sm text-amber-600 hover:text-amber-700"
            >
              ערוך
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              placeholder="הערות על האורח..."
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={saveNotes}
                disabled={updateGuestMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {updateGuestMutation.isPending ? "שומר..." : "שמור"}
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            {guest.notes || "אין הערות"}
          </p>
        )}
      </div>

      {/* Visit Insights Section */}
      {visitInsights && (visitInsights.favoriteItems?.length || visitInsights.dietaryProfile?.length || visitInsights.visitFrequency) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">תובנות ביקור</h3>
          <div className="space-y-3">
            {visitInsights.visitFrequency && (
              <div>
                <span className="text-sm font-medium text-gray-700">תדירות ביקורים: </span>
                <span className="text-sm text-gray-600">{visitInsights.visitFrequency}</span>
              </div>
            )}
            {visitInsights.favoriteItems && visitInsights.favoriteItems.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">פריטים מועדפים</p>
                <div className="flex flex-wrap gap-1">
                  {visitInsights.favoriteItems.map((item) => (
                    <span key={item} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {visitInsights.dietaryProfile && visitInsights.dietaryProfile.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">פרופיל תזונתי</p>
                <div className="flex flex-wrap gap-1">
                  {visitInsights.dietaryProfile.map((item) => (
                    <span key={item} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reservation history */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">היסטוריית הזמנות</h3>
        {!reservations || reservations.length === 0 ? (
          <p className="text-gray-500 text-sm">אין הזמנות קודמות</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-500">תאריך</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">שעה</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">סועדים</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">מקור</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Reservation) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono">{r.date}</td>
                  <td className="px-4 py-3 font-mono">{r.timeStart?.slice(0, 5)}</td>
                  <td className="px-4 py-3">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
