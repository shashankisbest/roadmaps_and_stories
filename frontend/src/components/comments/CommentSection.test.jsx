import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentSection from "./CommentSection";

afterEach(cleanup);

const comment = {
  id: 1,
  author: "Avery",
  time: "2026-10-30T12:00:00Z",
  text: "A useful comment",
  can_delete: true,
  replies: [{
    id: 2,
    author: "Morgan",
    time: "2026-10-30T12:01:00Z",
    text: "A nested reply",
    can_delete: false,
    replies: [],
  }],
};

describe("CommentSection", () => {
  it("renders nested replies and loading and error feedback", () => {
    const { rerender } = render(
      <CommentSection
        activeItem={{ title: "Roadmap" }}
        comments={[comment]}
        loading
        error="Could not refresh"
        newComment=""
        onCommentChange={vi.fn()}
        onCommentSubmit={vi.fn()}
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading comments");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh");

    rerender(
      <CommentSection
        activeItem={{ title: "Roadmap" }}
        comments={[comment]}
        loading={false}
        error=""
        newComment=""
        onCommentChange={vi.fn()}
        onCommentSubmit={vi.fn()}
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("A useful comment")).toBeInTheDocument();
    expect(screen.getByText("A nested reply")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete comment by Avery" })).toBeInTheDocument();
  });

  it("validates a new comment and submits on Enter", () => {
    const onCommentChange = vi.fn();
    const onCommentSubmit = vi.fn();
    const props = {
      activeItem: { title: "Roadmap" },
      comments: [],
      loading: false,
      error: "",
      onCommentChange,
      onCommentSubmit,
      onReply: vi.fn(),
      onDelete: vi.fn(),
    };
    const { rerender } = render(
      <CommentSection
        newComment=""
        {...props}
      />,
    );

    const postButton = screen.getByRole("button", { name: "Post" });
    expect(postButton).toBeDisabled();
    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(onCommentChange).toHaveBeenCalledWith("Hello");
    rerender(<CommentSection newComment="Hello" {...props} />);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommentSubmit).toHaveBeenCalledOnce();
  });

  it("verifies comment integrity only on demand and displays a passing result", async () => {
    const onVerify = vi.fn().mockResolvedValue({ valid: true });
    render(
      <CommentSection
        activeItem={{ title: "Roadmap" }}
        comments={[comment]}
        loading={false}
        error=""
        newComment=""
        onCommentChange={vi.fn()}
        onCommentSubmit={vi.fn()}
        onReply={vi.fn()}
        onDelete={vi.fn()}
        onVerify={onVerify}
      />,
    );

    expect(onVerify).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Verify integrity of comment by Avery" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Integrity verified: comment content matches.",
    );
    expect(onVerify).toHaveBeenCalledOnce();
    expect(onVerify).toHaveBeenCalledWith(1);
  });

  it("shows loading, failed verification, and request errors", async () => {
    let resolveVerification;
    const onVerify = vi.fn(
      () => new Promise((resolve) => {
        resolveVerification = resolve;
      }),
    );
    const props = {
      activeItem: { title: "Roadmap" },
      comments: [comment],
      loading: false,
      error: "",
      newComment: "",
      onCommentChange: vi.fn(),
      onCommentSubmit: vi.fn(),
      onReply: vi.fn(),
      onDelete: vi.fn(),
      onVerify,
    };
    const { rerender } = render(<CommentSection {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Verify integrity of comment by Avery" }),
    );

    const loadingButton = screen.getByRole("button", { name: "Verify integrity of comment by Avery" });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveTextContent("Verifying");
    resolveVerification({ valid: false });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Integrity check failed: comment content does not match.",
    );

    rerender(
      <CommentSection
        {...props}
        onVerify={vi.fn().mockRejectedValue(new Error("Network unavailable"))}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Verify integrity of comment by Avery" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verification error: Network unavailable",
    );
  });
});
