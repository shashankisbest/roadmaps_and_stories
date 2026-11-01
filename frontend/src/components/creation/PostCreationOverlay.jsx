import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import RoadmapCanvas from "./RoadmapCanvas";
import { generateRoadmapPreview } from "./roadmapPreview";
import "./postCreation.css";

function createInitialState() {
  return {
    title: "",
    description: "",
    content: "",
    storyline: "",
    tags: "",
    nodes: [],
    edges: [],
  };
}

export default function PostCreationOverlay({ onClose, onPublished }) {
  const [step, setStep] = useState("start");
  const [postType, setPostType] = useState(null);
  const [tab, setTab] = useState("roadmap");
  const [draft, setDraft] = useState(createInitialState);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [previewWarning, setPreviewWarning] = useState("");
  const [published, setPublished] = useState(false);
  const closeButtonRef = useRef(null);
  const overlayRef = useRef(null);

  const graph = useMemo(() => ({
    nodes: draft.nodes.map(({ data, ...node }) => ({
      ...node,
      data: {
        ...Object.fromEntries(
          Object.entries(data).filter(([, value]) => typeof value !== "function"),
        ),
      },
    })),
    edges: draft.edges,
  }), [draft.edges, draft.nodes]);

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
    function closeIfSafe() {
      if (!dirty || window.confirm("Discard your unsaved post?")) onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeIfSafe();
        return;
      }
      if (event.key !== "Tab" || !overlayRef.current) return;
      const focusable = overlayRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dirty, onClose]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setPublishError("");
  }

  function selectType(type) {
    setPostType(type);
    setTab(type === "roadmap" ? "roadmap" : "story");
    setStep("editor");
  }

  function requestClose() {
    if (!dirty || window.confirm("Discard your unsaved post?")) onClose();
  }

  async function publishPost(event) {
    event.preventDefault();
    if (publishing || published) return;
    setPublishError("");
    const tags = [...new Set(draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
    if (!draft.title.trim()) {
      setPublishError("Add a title before publishing.");
      return;
    }
    if (!draft.description.trim()) {
      setPublishError("Add a short description before publishing.");
      return;
    }
    if (postType === "story" && !draft.content.trim()) {
      setPublishError("Write your story before publishing.");
      return;
    }

    setPublishing(true);
    try {
      const postDraft = {
        type: postType,
        title: draft.title.trim(),
        description: draft.description.trim(),
        content: draft.content.trim(),
        ...(postType === "roadmap" ? { graph, storyline: draft.storyline } : {}),
        tags,
      };
      setPreviewWarning("");
      if (postType === "roadmap" && graph.nodes.length) {
        try {
          postDraft.preview = await generateRoadmapPreview(graph);
        } catch (error) {
          setPreviewWarning(
            `The roadmap will be published without its preview image: ${error.message}`,
          );
        }
      }
      const post = await api.createPost(postDraft);
      setPublished(true);
      setDirty(false);
      onPublished(post);
    } catch (error) {
      setPublishError(error.message);
    } finally {
      setPublishing(false);
    }
  }

  function renderStart() {
    return (
      <div className="creation-start">
        <div className="creation-eyebrow">A SPACE FOR WHAT'S NEXT</div>
        <h2 id="creation-dialog-title">Make something worth following.</h2>
        <p>Shape a roadmap or share a story with your community.</p>
        <div className="creation-start-options">
          <button className="creation-option creation-option-disabled" type="button" disabled>
            <span className="creation-option-icon">▤</span>
            <span><strong>Drafts</strong><small>Coming soon</small></span>
            <span className="creation-option-arrow">→</span>
          </button>
          <button className="creation-option" type="button" onClick={() => setStep("type")}>
            <span className="creation-option-icon">✦</span>
            <span><strong>New Post</strong><small>Start with a roadmap or story</small></span>
            <span className="creation-option-arrow">→</span>
          </button>
        </div>
      </div>
    );
  }

  function renderTypePicker() {
    return (
      <div className="creation-type-picker">
        <button className="creation-back-link" type="button" onClick={() => setStep("start")}>← Back</button>
        <div className="creation-eyebrow">CHOOSE YOUR FORMAT</div>
        <h2 id="creation-dialog-title">What are you creating?</h2>
        <p>Pick the format that best fits what you want to share.</p>
        <div className="creation-type-options">
          <button type="button" onClick={() => selectType("roadmap")}>
            <span className="creation-type-symbol">↗</span>
            <strong>Roadmap</strong>
            <small>Map your plan visually, with an optional storyline.</small>
          </button>
          <button type="button" onClick={() => selectType("story")}>
            <span className="creation-type-symbol">✎</span>
            <strong>Story</strong>
            <small>Write and share an independent text post.</small>
          </button>
        </div>
      </div>
    );
  }

  function renderPostSettings() {
    return (
      <form className="creation-settings" onSubmit={publishPost} noValidate>
        <div className="creation-settings-heading">
          <div className="creation-eyebrow">FINAL DETAILS</div>
          <h2 id="creation-dialog-title">Set up your post</h2>
          <p>A clear title and summary help people know what they'll find.</p>
        </div>
        <label className="creation-field">
          <span>Post title <b>*</b></span>
          <input
            value={draft.title}
            maxLength={250}
            autoComplete="off"
            placeholder="Give your post a name"
            onChange={(event) => updateDraft("title", event.target.value)}
            required
          />
          <small>{draft.title.length}/250</small>
        </label>
        <label className="creation-field">
          <span>Short description <b>*</b></span>
          <textarea
            value={draft.description}
            rows={4}
            placeholder="What is this post about?"
            onChange={(event) => updateDraft("description", event.target.value)}
            required
          />
        </label>
        <label className="creation-field">
          <span>Tags <small>Optional, comma separated</small></span>
          <input
            value={draft.tags}
            placeholder="e.g. design, product, learning"
            onChange={(event) => updateDraft("tags", event.target.value)}
          />
        </label>
        <div className="creation-field">
          <span>Visibility</span>
          <div className="creation-visibility">
            <span aria-hidden="true">◉</span>
            <span><strong>Public</strong><small>Visible to everyone</small></span>
            <small>Only available setting</small>
          </div>
        </div>
        {publishError && <p className="creation-publish-error" role="alert">{publishError}</p>}
        {previewWarning && <p className="creation-preview-warning" role="status">{previewWarning}</p>}
        {published ? (
          <div className="creation-publish-success" role="status">
            <span>✓</span> Published. Your post is now live.
            <button type="button" onClick={onClose}>Close editor</button>
          </div>
        ) : (
          <button className="creation-publish-button" type="submit" disabled={publishing}>
            {publishing ? "Publishing..." : "Publish post"}
            {!publishing && <span aria-hidden="true">↗</span>}
          </button>
        )}
      </form>
    );
  }

  const tabs = postType === "roadmap"
    ? [["roadmap", "Roadmap"], ["storyline", "Storyline"], ["post", "Post"]]
    : [["story", "Story"], ["post", "Post"]];

  return (
    <div className="creation-backdrop">
      <section
        className="creation-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-dialog-title"
        ref={overlayRef}
      >
        <header className="creation-header">
          <div className="creation-brand">
            <span className="creation-brand-mark">R</span>
            <span>ROADMAPS<span className="creation-brand-amp">&</span>STORIES</span>
            {postType && <span className="creation-header-divider">/</span>}
            {postType && <span className="creation-post-type">{postType === "roadmap" ? "New roadmap" : "New story"}</span>}
          </div>
          {step === "editor" && (
            <nav className="creation-tabs" aria-label="Post editor sections">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={tab === value ? "active" : ""}
                  aria-current={tab === value ? "page" : undefined}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          <button
            className="creation-close"
            type="button"
            onClick={requestClose}
            ref={closeButtonRef}
            aria-label="Close post editor"
          >
            <span>×</span>
          </button>
        </header>

        <main className={`creation-main creation-step-${step}`}>
          {step === "start" && renderStart()}
          {step === "type" && renderTypePicker()}
          {step === "editor" && (
            <>
              {postType === "roadmap" && tab === "roadmap" && (
                <div className="creation-canvas-panel">
                  <div className="creation-panel-heading">
                    <div><span className="creation-eyebrow">VISUAL PLANNER</span><h1 id="creation-dialog-title">Build your roadmap</h1></div>
                    <p>Drag steps to arrange them · Connect the handles to show progression · Delete selected steps with Delete</p>
                  </div>
                  <RoadmapCanvas
                    nodes={draft.nodes}
                    edges={draft.edges}
                    setNodes={(update) => {
                      setDraft((current) => ({
                        ...current,
                        nodes: typeof update === "function" ? update(current.nodes) : update,
                      }));
                      setDirty(true);
                    }}
                    setEdges={(update) => {
                      setDraft((current) => ({
                        ...current,
                        edges: typeof update === "function" ? update(current.edges) : update,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
              )}
              {postType === "roadmap" && tab === "storyline" && (
                <div className="creation-writing-panel">
                  <div className="creation-eyebrow">OPTIONAL SUPPLEMENT</div>
                  <h1 id="creation-dialog-title">Add a storyline</h1>
                  <p>Give your roadmap the context behind the milestones. This belongs to the roadmap and isn't a separate post.</p>
                  <textarea
                    className="creation-story-editor"
                    value={draft.storyline}
                    placeholder="What inspired this roadmap? What should people know about the journey?"
                    onChange={(event) => updateDraft("storyline", event.target.value)}
                    aria-label="Roadmap storyline"
                  />
                </div>
              )}
              {postType === "story" && tab === "story" && (
                <div className="creation-writing-panel">
                  <div className="creation-eyebrow">INDEPENDENT STORY</div>
                  <h1 id="creation-dialog-title">Write your story</h1>
                  <p>Share an idea, a lesson, or a moment worth remembering.</p>
                  <textarea
                    className="creation-story-editor"
                    value={draft.content}
                    placeholder="Start writing..."
                    onChange={(event) => updateDraft("content", event.target.value)}
                    aria-label="Story content"
                    required
                  />
                </div>
              )}
              {tab === "post" && (
                <div className="creation-post-panel">
                  <div className="creation-post-scroll">{renderPostSettings()}</div>
                </div>
              )}
            </>
          )}
        </main>
      </section>
    </div>
  );
}
