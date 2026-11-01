import { useState } from "react";

function formatCommentTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CommentNode({ comment, onReply, onDelete }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState(false);

  function submitReply() {
    if (!draft.trim()) return;
    onReply(comment.id, draft.trim());
    setDraft("");
    setReplying(false);
  }

  async function deleteComment() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="comment-node">
      <div className="comment-row">
        <div className="comment-avatar">{comment.author[0].toUpperCase()}</div>

        <div className="comment-body">
          <div className="comment-meta">
            <strong>{comment.author}</strong>
            <span>{formatCommentTime(comment.time)}</span>
          </div>

          <p>{comment.text}</p>

          <div className="comment-tools">
            <button onClick={() => setReplying(!replying)}>
              {replying ? "Cancel" : "↳ Reply"}
            </button>
            <span>
              {comment.replies.length
                ? `${comment.replies.length} repl${comment.replies.length === 1 ? "y" : "ies"}`
                : ""}
            </span>
            {comment.can_delete && (
              <button
                type="button"
                disabled={deleting}
                onClick={deleteComment}
                aria-label={`Delete comment by ${comment.author}`}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>

          {replying && (
            <div className="reply-composer">
              <input
                autoFocus
                placeholder={`Reply to ${comment.author}...`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitReply();
                  if (e.key === "Escape") setReplying(false);
                }}
              />
              <button onClick={submitReply}>Send</button>
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="nested-replies">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
