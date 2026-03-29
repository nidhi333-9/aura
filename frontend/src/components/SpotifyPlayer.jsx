// src/components/SpotifyPlayer.jsx
const SpotifyPlayer = ({ spotifyUri }) => {
  // Converts "spotify:playlist:ID" to "playlist/ID"
  const embedPath = spotifyUri.replace("spotify:", "").replace(/:/g, "/");

  return (
    <div className="w-full bg-white/50 backdrop-blur-md rounded-[32px] p-6 border border-white/20 shadow-lg mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl">🎵</span>
        <h3 className="font-bold text-[var(--aura-dark)] text-sm">
          Focus Soundscape
        </h3>
      </div>

      <iframe
        src={`https://open.spotify.com/embed/${embedPath}?utm_source=generator&theme=0`}
        width="100%"
        height="152"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="rounded-2xl"
      ></iframe>

      <p className="text-[10px] text-gray-400 mt-3 text-center italic">
        Log in to Spotify in your browser for full tracks.
      </p>
    </div>
  );
};

export default SpotifyPlayer;
