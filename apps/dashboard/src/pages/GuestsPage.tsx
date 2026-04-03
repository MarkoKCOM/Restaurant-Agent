export function GuestsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">אורחים</h2>
        <input
          type="search"
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
              <th className="text-right px-4 py-3 font-medium text-gray-500">ביקור אחרון</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">תגיות</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                אין אורחים רשומים עדיין
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
