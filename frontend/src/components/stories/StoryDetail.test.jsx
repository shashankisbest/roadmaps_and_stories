import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoadmapDetail from "../roadmaps/RoadmapDetail";
import StoryDetail from "./StoryDetail";

afterEach(cleanup);

const roadmap = { id: 8, type: "roadmap", title: "Platform roadmap" };
const story = {
  id: 9,
  type: "story",
  title: "Launch story",
  author: "Morgan",
  date: "2026-10-30",
  content: "What happened at launch",
  roadmapId: roadmap.id,
};

describe("roadmap and story details", () => {
  it("renders a story and navigates to its related roadmap", () => {
    const onSelectRoadmap = vi.fn();
    render(
      <StoryDetail
        activeItem={story}
        roadmaps={[roadmap]}
        onSelectRoadmap={onSelectRoadmap}
      />,
    );

    expect(screen.getByRole("heading", { name: "Launch story" })).toBeInTheDocument();
    expect(screen.getByText("What happened at launch")).toBeInTheDocument();
    expect(screen.getByText("Platform roadmap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open storyline →" }));
    expect(onSelectRoadmap).toHaveBeenCalledWith(roadmap);
  });

  it("renders a roadmap storyline and linked stories and opens a selected story", () => {
    const onSelectStory = vi.fn();
    const onOpenRoadmap = vi.fn();
    render(
      <RoadmapDetail
        activeItem={{ ...roadmap, storyline: "The long-term plan" }}
        relatedStories={[story]}
        onSelectStory={onSelectStory}
        onOpenRoadmap={onOpenRoadmap}
      />,
    );

    expect(screen.getByText("The long-term plan")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Launch story" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Launch story/ }));
    expect(onSelectStory).toHaveBeenCalledWith(story);
    expect(onOpenRoadmap).toHaveBeenCalledOnce();
  });
});
