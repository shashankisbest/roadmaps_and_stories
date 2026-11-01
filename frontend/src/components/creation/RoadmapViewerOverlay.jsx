import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import RoadmapCanvas from "./RoadmapCanvas";
import "./roadmapViewer.css";

export default function RoadmapViewerOverlay({ roadmap, onClose }) {
  const [graph, setGraph] = useState(roadmap.graph);
  const [loading, setLoading] = useState(!roadmap.graph);
  const [error, setError] = useState("");
  const closeButtonRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !viewerRef.current) return;
      const focusable = viewerRef.current.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (roadmap.graph) return undefined;
    let cancelled = false;
    api.roadmap(roadmap.id)
      .then((result) => {
        if (!cancelled) {
          setGraph(result.graph);
          setError(result.graph ? "" : "This roadmap does not have graph data.");
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roadmap.graph, roadmap.id]);

  return (
    <div
      className="roadmap-viewer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="roadmap-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-viewer-title"
        ref={viewerRef}
      >
        <header className="roadmap-viewer-header">
          <div>
            <span className="roadmap-viewer-eyebrow">ROADMAP PREVIEW</span>
            <h2 id="roadmap-viewer-title">{roadmap.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="roadmap-viewer-close"
            aria-label="Close roadmap viewer"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="roadmap-viewer-content">
          {loading ? (
            <p className="roadmap-viewer-message" role="status">Loading roadmap graph…</p>
          ) : error ? (
            <p className="roadmap-viewer-message" role="alert">{error}</p>
          ) : graph && graph.nodes?.length ? (
            <RoadmapCanvas
              nodes={graph.nodes || []}
              edges={graph.edges || []}
              readOnly
            />
          ) : (
            <p className="roadmap-viewer-message" role="alert">
              This roadmap does not have any graph steps to display.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
