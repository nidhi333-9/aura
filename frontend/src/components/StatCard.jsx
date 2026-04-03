const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl shadow-md border border-white/50 flex items-center gap-5">
    <div className="text-3xl p-3 bg-gray-50 rounded-2xl">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
        {title}
      </p>
      <h2 className="text-2xl font-bold" style={{ color }}>
        {value}
      </h2>
    </div>
  </div>
);

export default StatCard;
