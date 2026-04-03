export function ReservationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">הזמנות</h2>
        <button className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
          + הזמנה חדשה
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="date"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="confirmed">מאושר</option>
          <option value="seated">יושב</option>
          <option value="completed">הושלם</option>
          <option value="cancelled">בוטל</option>
          <option value="no_show">לא הגיע</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">שעה</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">אורח</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">סועדים</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">שולחן</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">פעולות</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                אין הזמנות לתאריך זה
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
