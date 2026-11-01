export default function StoryDetail({ activeItem, roadmaps, onSelectRoadmap }) {
  return (
    <div className="right-content">
      {activeItem?.type === "story" ? (
        <article className="full-story">
          <span className="content-type">STORY</span>
          <h2>{activeItem.title}</h2>
          <div className="context-author">
            <div className="person-avatar">{activeItem.author[0]}</div>
            <div>
              <strong>{activeItem.author}</strong>
              <p>{activeItem.date}</p>
            </div>
          </div>
          <p className="story-body">{activeItem.content}</p>

          {activeItem.roadmapId ? (
            <div className="linked-roadmap">
              <span>RELATED ROADMAP</span>
              <strong>
                {roadmaps.find((r) => r.id === activeItem.roadmapId)?.title}
              </strong>
              <button
                onClick={() => {
                  onSelectRoadmap(
                    roadmaps.find((r) => r.id === activeItem.roadmapId)
                  );
                }}
              >
                Open storyline →
              </button>
            </div>
          ) : (
            <div className="linked-roadmap">
              <span>INDEPENDENT STORY</span>
              <strong>This story isn't attached to a roadmap.</strong>
            </div>
          )}
        </article>
      ) : (
        <div className="empty-state">
          <span>✎</span>
          <h3>Select a story from the left side, wallah habibi.</h3>
          <p>
            Pick a story from the left wall to read it here. Roadmap cards belong to
            the Storyline view.
          </p>
        </div>
      )}
    </div>
  );
}
