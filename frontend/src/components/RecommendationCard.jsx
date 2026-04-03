const RecommendationCard = ({ video }) => (
  <div className="group bg-white/50 hover:bg-white p-4 rounded-3xl border border-white/20 transition-all duration-300 shadow-sm hover:shadow-md">
    <div className="relative mb-4 overflow-hidden rounded-2xl">
      {/* High-quality YouTube Thumbnail */}
      <img
        src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
        alt={video.title}
        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-lg font-bold">
        {video.duration}
      </div>
    </div>

    <div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-blue)] mb-1 block">
        {video.context || "Recommended for Focus"}
      </span>
      <h4 className="text-sm font-bold text-[var(--aura-dark)] line-clamp-2 mb-3">
        {video.title}
      </h4>

      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[var(--aura-blue)] transition-colors"
      >
        Watch on YouTube <span className="text-lg">↗</span>
      </a>
    </div>
  </div>
);

export default RecommendationCard;
