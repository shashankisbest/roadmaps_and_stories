export default function RoadmapDetail({
  activeItem,
  relatedStories,
  onSelectStory,
  onOpenRoadmap,
}) {
  return (
    <div className="right-content">
      <div className="view-heading">
        <span>CONNECTED EXPERIENCES</span>
        <h2>Storyline</h2>
        <p>Stories linked to a specific roadmap.</p>
      </div>

      {activeItem?.type !== "roadmap" ? (
        <div className="empty-state">
          <span>⌁</span>
          <h3>Select a roadmap from the left, wallah habibi.</h3>
          <p>
            The storyline follows the roadmap you select. Choose a roadmap to
            discover the experiences connected to it.
          </p>
        </div>
      ) : (
        <div className="storyline-list">
          <div className="linked-roadmap">
            <span>ROADMAP</span>
            <strong>{activeItem.title}</strong>
          </div>

          {activeItem.storyline && (
            <article className="storyline-card roadmap-storyline">
              <div>
                <span>ROADMAP STORYLINE</span>
                <p>{activeItem.storyline}</p>
              </div>
            </article>
          )}

          {relatedStories.length === 0 && !activeItem.storyline && (
            <div className="empty-state">
              <h3>No linked stories yet</h3>
              <p>Stories related to this roadmap will appear here.</p>
            </div>
          )}

          {relatedStories.map((story, index) => (
            <button
              className="storyline-card"
              key={story.id}
              onClick={() => {
                onSelectStory(story);
                onOpenRoadmap();
              }}
            >
              <div className="timeline-marker">{index + 1}</div>
              <div>
                <span>{story.date}</span>
                <h3>{story.title}</h3>
                <p>{story.content}</p>
                <small>By {story.author} · Read story →</small>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
