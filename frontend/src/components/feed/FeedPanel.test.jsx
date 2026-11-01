import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import FeedPanel from "./FeedPanel";

vi.mock("../../api/client", () => ({
  api: {
    toggleLike: vi.fn(),
  },
}));

afterEach(cleanup);

const roadmap = {
  id: 8,
  type: "roadmap",
  title: "Platform roadmap",
  description: "A plan for the platform",
  author: "Avery",
  author_profile: { username: "avery" },
  date: "2026-10-30",
  preview_url: null,
  tags: ["Planning"],
  like_count: 2,
  comment_count: 3,
  liked_by_user: false,
};

const story = {
  id: 9,
  type: "story",
  title: "Launch story",
  description: "The launch",
  content: "What happened at launch",
  author: "Morgan",
  author_profile: { username: "morgan" },
  date: "2026-10-30",
  tags: [],
  like_count: 1,
  comment_count: 0,
  liked_by_user: false,
};

function renderFeed(overrides = {}) {
  const props = {
    activeFeed: "roadmaps",
    activeItem: roadmap,
    roadmaps: [roadmap],
    stories: [story],
    loading: false,
    error: "",
    onFeedChange: vi.fn(),
    onOpenItem: vi.fn(),
    onOpenRoadmap: vi.fn(),
    onOpenComments: vi.fn(),
    onLikeChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<FeedPanel {...props} />), props };
}

describe("FeedPanel", () => {
  it("renders roadmap cards and opens the roadmap and its comments", () => {
    const { props } = renderFeed();

    expect(screen.getByRole("heading", { name: "Platform roadmap" })).toBeInTheDocument();
    expect(screen.getByText("A plan for the platform")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show tags" }));
    expect(screen.getByText("Planning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open roadmap graph: Platform roadmap" }));
    expect(props.onOpenRoadmap).toHaveBeenCalledWith(roadmap);
    expect(props.onOpenItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open comments, 3 comments" }));
    expect(props.onOpenComments).toHaveBeenCalledWith(roadmap);
    expect(api.toggleLike).not.toHaveBeenCalled();
  });

  it("switches feeds and displays story cards and request states", () => {
    const { rerender, props } = renderFeed({ activeFeed: "stories" });

    expect(screen.getByRole("heading", { name: "Launch story" })).toBeInTheDocument();
    expect(screen.getByText("The launch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Switch between roadmaps and stories",
    }));
    expect(props.onFeedChange).toHaveBeenCalledWith("roadmaps");

    rerender(
      <FeedPanel
        {...props}
        activeFeed="roadmaps"
        roadmaps={[]}
        stories={[]}
        loading
        error="Feed unavailable"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading posts");
    expect(screen.getByRole("alert")).toHaveTextContent("Feed unavailable");
  });
});
