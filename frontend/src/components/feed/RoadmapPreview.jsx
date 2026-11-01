import { useState } from "react";

export default function RoadmapPreview({ roadmap, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const previewUrl = roadmap.preview_url && !imageFailed ? roadmap.preview_url : null;

  return (
    <button
      type="button"
      className="roadmap-preview"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(roadmap);
      }}
      aria-label={`Open roadmap graph: ${roadmap.title}`}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Graph preview for ${roadmap.title}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="roadmap-preview-fallback">
          <span aria-hidden="true">⌘</span>
          Preview image unavailable · Open graph
        </span>
      )}
      {previewUrl && !imageLoaded && (
        <span className="roadmap-preview-loading" role="status">Loading preview…</span>
      )}
      <span className="roadmap-preview-open">Open roadmap ↗</span>
    </button>
  );
}
