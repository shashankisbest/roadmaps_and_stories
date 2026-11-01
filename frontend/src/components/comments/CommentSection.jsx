import CommentNode from "./CommentNode";

export default function CommentSection({
  activeItem,
  comments,
  loading,
  error,
  newComment,
  onCommentChange,
  onCommentSubmit,
  onReply,
  onDelete,
}) {
  return (
    <div className="right-content">
      <div className="view-heading">
        <span>DISCUSSION</span>
        <h2>{activeItem ? activeItem.title : "Comments"}</h2>
        <p>Conversations can branch into as many reply levels as needed.</p>
      </div>

      {!activeItem && (
        <div className="empty-state">
          <span>↳</span>
          <h3>Select a post from the left</h3>
          <p>Its comment discussion will appear here.</p>
        </div>
      )}

      {error && <p role="alert">Discussion error: {error}</p>}
      <div className="comment-list">
        {loading ? (
          <p role="status">Loading comments…</p>
        ) : comments.length ? (
          comments.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            onReply={onReply}
            onDelete={onDelete}
          />
          ))
        ) : activeItem ? (
          <p>No comments yet. Start the discussion.</p>
        ) : null}
      </div>

      <div className="new-comment">
        <div className="comment-avatar">S</div>
        <input
          placeholder="Add a comment..."
          value={newComment}
          disabled={!activeItem}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommentSubmit();
          }}
        />
        <button disabled={!activeItem || !newComment.trim()} onClick={onCommentSubmit}>Post</button>
      </div>
    </div>
  );
}
