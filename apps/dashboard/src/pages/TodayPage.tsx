export function TodayPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">היום</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "הזמנות", value: "0", color: "bg-blue-50 text-blue-700" },
          { label: "סועדים", value: "0", color: "bg-green-50 text-green-700" },
          { label: "ביטולים", value: "0", color: "bg-amber-50 text-amber-700" },
          { label: "לא הגיעו", value: "0", color: "bg-red-50 text-red-700" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Reservations list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">הזמנות להיום</h3>
        <p className="text-gray-500 text-sm">אין הזמנות להיום. הזמנות חדשות יופיעו כאן.</p>
        {/* TODO: reservation list with time, guest name, party size, status, table */}
      </div>
    </div>
  );
}
