export function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">הגדרות</h2>

      <div className="space-y-6">
        {/* Restaurant details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">פרטי המסעדה</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
              <input type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </section>

        {/* Operating hours */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">שעות פעילות</h3>
          <p className="text-gray-500 text-sm">TODO: hours editor per day of week</p>
        </section>

        {/* Table map */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">מפת שולחנות</h3>
          <p className="text-gray-500 text-sm">TODO: table map editor — add/edit/remove tables with seats and zones</p>
        </section>

        {/* Widget branding */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">עיצוב ווידג׳ט</h3>
          <p className="text-gray-500 text-sm">TODO: primary color picker, logo upload, welcome text</p>
        </section>
      </div>
    </div>
  );
}
