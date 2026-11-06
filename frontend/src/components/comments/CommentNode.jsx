import { useState } from "react";

function formatCommentTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CommentNode({ comment, onReply, onDelete, onVerify }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);
  const [verificationError, setVerificationError] = useState("");

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

  async function verifyIntegrity() {
    if (verifying || !onVerify) return;
    setVerifying(true);
    setVerification(null);
    setVerificationError("");
    try {
      const result = await onVerify(comment.id);
      setVerification(result.valid);
    } catch (error) {
      setVerificationError(error.message || "Could not verify comment integrity.");
    } finally {
      setVerifying(false);
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
            {onVerify && !comment.is_deleted && (
              <button
                type="button"
                disabled={verifying}
                onClick={verifyIntegrity}
                aria-label={`Verify integrity of comment by ${comment.author}`}
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            )}
          </div>
          {verification !== null && (
            <p className={`comment-integrity-result${verification ? " valid" : " invalid"}`} role="status">
              {verification
                ? "Integrity verified: comment content matches."
                : "Integrity check failed: comment content does not match."}
            </p>
          )}
          {verificationError && (
            <p className="comment-integrity-result invalid" role="alert">
              Verification error: {verificationError}
            </p>
          )}

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
              onVerify={onVerify}
            />
          ))}
        </div>
      )}
    </div>
  );
}
