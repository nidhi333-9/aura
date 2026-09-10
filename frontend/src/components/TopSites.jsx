const COLORS = [
  "var(--aura-blue)",
  "#a855f7",
  "var(--aura-green)",
  "#f59e0b",
  "#ec4899",
];

const TopSites = ({ topSites, onInstallClick }) => {
  const sorted = topSites
    ? Object.entries(topSites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/40 shadow-xl">
      <h3 className="text-xl font-extrabold text-[var(--aura-dark)] tracking-tight mb-8">
        Top Apps & Sites
      </h3>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 py-10">
          {onInstallClick ? (
            <button
              type="button"
              onClick={onInstallClick}
              className="text-sm font-medium underline underline-offset-4 decoration-dashed hover:text-[var(--aura-blue)] transition-colors"
            >
              No activity tracked yet — install the sensor to get started.
            </button>
          ) : (
            <p className="text-sm font-medium">
              No activity tracked yet — install the sensor to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sorted.map(([name, count], i) => (
            <div key={name} className="flex items-center gap-4">
              <span className="text-xs font-black text-gray-300 w-5">
                {i + 1}
              </span>
              <div className="flex-grow">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm font-bold text-[var(--aura-dark)]">
                    {name}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">
                    {count}
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopSites;
