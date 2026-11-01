import { useRef, useState } from "react";
import { api } from "../../api/client";
import RoadmapPreview from "./RoadmapPreview";

function formatPostDate(value) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateParts
    ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
}

function avatarSource(value) {
  return value && (/^(https?:|data:image\/)/i.test(value) || value.startsWith("/"))
    ? value
    : null;
}

function FeedCard({
  item,
  activeItem,
  onOpenItem,
  onOpenRoadmap,
  onOpenComments,
  onLikeChange,
}) {
  const [tagsVisible, setTagsVisible] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState("");
  const likePendingRef = useRef(false);
  const isRoadmap = item.type === "roadmap";
  const avatar = avatarSource(item.author_profile?.profile_image);

  async function toggleLike(event) {
    event.stopPropagation();
    if (likePendingRef.current) return;
    likePendingRef.current = true;
    const previousLiked = Boolean(item.liked_by_user);
    const previousCount = item.like_count || 0;
    const nextLiked = !previousLiked;
    setLikePending(true);
    setLikeError("");
    onLikeChange(item.id, {
      liked_by_user: nextLiked,
      like_count: Math.max(0, previousCount + (nextLiked ? 1 : -1)),
    });
    try {
      const result = await api.toggleLike(item.id, nextLiked);
      onLikeChange(item.id, {
        liked_by_user: result.liked,
        like_count: result.like_count,
      });
    } catch (error) {
      onLikeChange(item.id, {
        liked_by_user: previousLiked,
        like_count: previousCount,
      });
      setLikeError(
        (error.status === 401 || error.status === 403)
          ? "Log in to like this post."
          : error.message,
      );
    } finally {
      likePendingRef.current = false;
      setLikePending(false);
    }
  }

  return (
    <article
      key={`${item.type}-${item.id}`}
      className={`content-card ${isRoadmap ? "roadmap-card" : "story-card"} ${
        activeItem?.id === item.id && activeItem?.type === item.type ? "selected" : ""
      }`}
      onClick={() => onOpenItem(item)}
    >
      {!isRoadmap && (
        <>
          <div className="card-top">
            <span className="content-type">{item.type.toUpperCase()}</span>
            <button
              className="more"
              onClick={(event) => event.stopPropagation()}
              aria-label="More options"
            >
              ···
            </button>
          </div>
          <h2>{item.title}</h2>
          <p>{item.description || item.content}</p>
          {item.tags?.length > 0 && (
            <div className="tags">
              {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </>
      )}

      {isRoadmap && (
        <>
          <div className="roadmap-card-heading">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
          <RoadmapPreview roadmap={item} onOpen={onOpenRoadmap} />
          <div className="roadmap-card-tags">
            <button
              type="button"
              aria-expanded={tagsVisible}
              onClick={(event) => {
                event.stopPropagation();
                setTagsVisible((visible) => !visible);
              }}
            >
              {tagsVisible ? "Hide tags" : "Show tags"}
            </button>
            {tagsVisible && item.tags?.length > 0 && (
              <div className="tags">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
            {tagsVisible && !item.tags?.length && (
              <span className="roadmap-no-tags">No tags on this roadmap.</span>
            )}
          </div>
        </>
      )}

      <div className="card-footer">
        <div className="card-author">
          {avatar ? (
            <img className="small-avatar" src={avatar} alt="" loading="lazy" />
          ) : (
            <div className="small-avatar" aria-hidden="true">
              {(item.author_profile?.username || item.author || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="card-author-name">
            {item.author_profile?.username || item.author}
          </span>
          <span className="dot">·</span>
          <time dateTime={item.date}>{formatPostDate(item.date)}</time>
        </div>
        <div className="card-engagement">
          <button
            type="button"
            className={`card-engagement-button${item.liked_by_user ? " liked" : ""}`}
            aria-label={`${item.liked_by_user ? "Unlike" : "Like"} post, ${item.like_count ?? 0} likes`}
            aria-pressed={Boolean(item.liked_by_user)}
            disabled={likePending}
            onClick={toggleLike}
          >
            <span aria-hidden="true">{item.liked_by_user ? "♥" : "♡"}</span>
            {item.like_count ?? 0}
          </button>
          <button
            type="button"
            className="card-engagement-button"
            aria-label={`Open comments, ${item.comment_count ?? 0} comments`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenComments(item);
            }}
          >
            <span aria-hidden="true">↳</span>
            {item.comment_count ?? 0}
          </button>
        </div>
      </div>
      {likeError && <p className="card-action-error" role="alert">{likeError}</p>}
    </article>
  );
}

export default function FeedPanel({
  activeFeed,
  activeItem,
  roadmaps,
  stories,
  loading,
  error,
  onFeedChange,
  onOpenItem,
  onOpenRoadmap,
  onOpenComments,
  onLikeChange,
}) {
  const items = activeFeed === "roadmaps" ? roadmaps : stories;

  return (
    <section className="left-panel">
      <header className="left-panel-header">
        <span className={activeFeed === "roadmaps" ? "active" : ""}>Roadmaps</span>

        <label className="feed-switch">
          <input
            type="checkbox"
            checked={activeFeed === "stories"}
            onChange={(e) => onFeedChange(e.target.checked ? "stories" : "roadmaps")}
            aria-label="Switch between roadmaps and stories"
          />
          <span className="feed-switch-slider" />
        </label>

        <span className={activeFeed === "stories" ? "active" : ""}>Stories</span>
      </header>

      <div className="feed">
        {error && <p className="empty-state" role="alert">Could not load posts: {error}</p>}
        {loading ? (
          <p className="empty-state" role="status">Loading posts…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">No {activeFeed} have been published yet.</p>
        ) : (
          items.map((item) => (
            <FeedCard
              key={`${item.type}-${item.id}`}
              item={item}
              activeItem={activeItem}
              onOpenItem={onOpenItem}
              onOpenRoadmap={onOpenRoadmap}
              onOpenComments={onOpenComments}
              onLikeChange={onLikeChange}
            />
          ))
        )}
      </div>
    </section>
  );
}
