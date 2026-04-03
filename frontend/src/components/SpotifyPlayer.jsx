const getPlaylistInfo = (score) => {
  if (score > 80)
    return {
      id: "37i9dQZF1DX8NTLIssmsS6",
      name: "Deep Focus",
      desc: "Intense concentration music",
    };
  if (score > 50)
    return {
      id: "37i9dQZF1DWZeKCadgRdKQ",
      name: "Chill Vibes",
      desc: "Relaxed focus mode",
    };
  return {
    id: "37i9dQZF1DX3rxVfibe1L0",
    name: "Energy Boost",
    desc: "High energy to get you going",
  };
};

const SpotifyPlayer = ({ focusScore }) => {
  const { id, name, desc } = getPlaylistInfo(focusScore);

  return (
    <div className="w-full bg-white/50 backdrop-blur-md rounded-[32px] p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl">🎵</span>
        <h3 className="font-bold text-[var(--aura-dark)] text-sm">{name}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3 italic">{desc}</p>
      <iframe
        key={id}
        src={`https://open.spotify.com/embed/playlist/${id}`}
        width="100%"
        height="152"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media"
        loading="lazy"
        className="rounded-2xl"
      />
    </div>
  );
};

export default SpotifyPlayer;
