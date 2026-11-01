
import { useState } from "react";
import "./App.css";

const roadmaps = [
  {
    id: 1,
    title: "Full Stack Web Development",
    author: "Arjun",
    description:
      "A practical roadmap covering frontend, backend, databases and deployment.",
    tags: ["Web", "React", "Django"],
  },
  {
    id: 2,
    title: "Machine Learning Roadmap",
    author: "Priya",
    description:
      "From Python and mathematics to machine learning and real-world projects.",
    tags: ["ML", "Python", "AI"],
  },
  {
    id: 3,
    title: "System Design",
    author: "Rahul",
    description:
      "Learn scalable systems, distributed architecture, caching and databases.",
    tags: ["System Design", "Backend"],
  },
];

const stories = [
  {
    id: 1,
    title: "How I finally understood distributed systems",
    author: "Aman",
    content:
      "I used to think distributed systems were just about multiple servers. The real difficulty is dealing with failure, consistency and communication.",
  },
  {
    id: 2,
    title: "My first month learning React",
    author: "Sneha",
    content:
      "Coming from Django, React initially felt strange. Once I understood components and state, things became much easier.",
  },
];

function App() {
  const [activeItem, setActiveItem] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState("discover");
  const [activeFeed, setActiveFeed] = useState("roadmaps");

  const openItem = (item, type) => {
    setActiveItem({ ...item, type });
    setRightPanel(type === "roadmap" ? "details" : "comments");
  };

  return (
    <div className="app">

      {/* FLOATING NAVIGATION */}
      <div className={`floating-nav ${menuOpen ? "open" : ""}`}>

        <div className="nav-bubbles">

          <button className="nav-bubble search-bubble" title="Search">
            ⌕
          </button>

          <button className="nav-bubble create-bubble" title="Create">
            +
          </button>

          <button className="nav-bubble explore-bubble" title="Explore">
            ◇
          </button>

          <button className="nav-bubble saved-bubble" title="Saved">
            ♡
          </button>

          <button className="nav-bubble profile-bubble" title="Profile">
            S
          </button>

        </div>

        <button
          className="main-nav-bubble"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Navigation"
        >
          {menuOpen ? "×" : "☰"}
        </button>
      </div>

      {/* MAIN 50/50 WORKSPACE */}
      <main className="workspace">

        {/* LEFT */}
        <section className="left-panel">
          <header className="left-panel-header">
            <span className={activeFeed === "roadmaps" ? "active" : ""}>
              Roadmaps
            </span>
            <label className="feed-switch">
              <input
                type="checkbox"
                role="switch"
                aria-label="Show stories"
                checked={activeFeed === "stories"}
                onChange={(event) =>
                  setActiveFeed(event.target.checked ? "stories" : "roadmaps")
                }
              />
              <span className="feed-switch-slider" />
            </label>
            <span className={activeFeed === "stories" ? "active" : ""}>
              Stories
            </span>
          </header>

         {/*
          <div className="section-intro">
            <div className="eyebrow">ROADMAPS & STORIES</div>

            <h1>Explore ideas.</h1>

            <p>
              Follow roadmaps, discover stories and learn from what other
              people are building.
            </p>
            <div className="filters">
            <button className="filter active">For You</button>
            <button className="filter">Roadmaps</button>
            <button className="filter">Stories</button>
            </div>
            </div>
        */}

          <div className="feed">
            {activeFeed === "roadmaps" && roadmaps.map((roadmap) => (
              <article
                className={`content-card ${
                  activeItem?.id === roadmap.id &&
                  activeItem?.type === "roadmap"
                    ? "selected"
                    : ""
                }`}
                key={roadmap.id}
                onClick={() => openItem(roadmap, "roadmap")}
              >
                <div className="card-top">
                  <span className="content-type">ROADMAP</span>

                  <button
                    className="more"
                    onClick={(event) => event.stopPropagation()}
                  >
                    ···
                  </button>
                </div>

                <h2>{roadmap.title}</h2>

                <p>{roadmap.description}</p>

                <div className="tags">
                  {roadmap.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="card-footer">
                  <div className="small-avatar">
                    {roadmap.author[0]}
                  </div>

                  <span>{roadmap.author}</span>
                  <span className="dot">·</span>
                  <span>12 min read</span>

                  <span className="spacer" />

                  <span>♡ 24</span>
                  <span>◌ 8</span>
                </div>
              </article>
            ))}

            {activeFeed === "stories" && stories.map((story) => (
              <article
                className={`content-card story-card ${
                  activeItem?.id === story.id &&
                  activeItem?.type === "story"
                    ? "selected"
                    : ""
                }`}
                key={story.id}
                onClick={() => openItem(story, "story")}
              >
                <div className="card-top">
                  <span className="content-type story-type">
                    STORY
                  </span>

                  <button
                    className="more"
                    onClick={(event) => event.stopPropagation()}
                  >
                    ···
                  </button>
                </div>

                <h2>{story.title}</h2>

                <p>{story.content}</p>

                <div className="card-footer">
                  <div className="small-avatar">
                    {story.author[0]}
                  </div>

                  <span>{story.author}</span>
                  <span className="dot">·</span>
                  <span>5 min read</span>

                  <span className="spacer" />

                  <span>♡ 17</span>
                  <span>◌ 4</span>
                </div>
              </article>
            ))}

          </div>
        </section>

        {/* RIGHT */}
        <aside className="right-panel">

          <header className="right-top">
            <div className="liquid-group" role="radiogroup" aria-label="Right panel section">
              <input
                type="radio"
                id="right-section-comments"
                name="right-section"
                defaultChecked
              />
              <label htmlFor="right-section-comments">Comments</label>

              <input
                type="radio"
                id="right-section-storyline"
                name="right-section"
              />
              <label htmlFor="right-section-storyline">Storyline</label>

              <input
                type="radio"
                id="right-section-stories"
                name="right-section"
              />
              <label htmlFor="right-section-stories">Stories</label>

              <input
                type="radio"
                id="right-section-profile"
                name="right-section"
              />
              <label htmlFor="right-section-profile">Profile</label>

              <input
                type="radio"
                id="right-section-game"
                name="right-section"
              />
              <label htmlFor="right-section-game">Game</label>

              <div className="liquid-slider" aria-hidden="true" />
            </div>
          </header>

          {!activeItem && rightPanel === "discover" && (
            <div className="discover-panel">

              <div className="right-heading">
                <span>YOUR SPACE</span>
                <h2>Discover something.</h2>
              </div>

              <div className="tile featured-tile">
                <div className="tile-label">TRENDING</div>

                <h3>System Design</h3>

                <p>
                  Popular roadmaps and discussions around scalable
                  systems, architecture and backend engineering.
                </p>

                <button className="tile-action">
                  Explore →
                </button>
              </div>

              <div className="tile">

                <div className="tile-label">
                  PEOPLE TO FOLLOW
                </div>

                <div className="person">
                  <div className="person-avatar">A</div>

                  <div>
                    <strong>Arjun</strong>
                    <p>Full Stack Developer</p>
                  </div>

                  <button>Follow</button>
                </div>

                <div className="person">
                  <div className="person-avatar">P</div>

                  <div>
                    <strong>Priya</strong>
                    <p>ML Engineer</p>
                  </div>

                  <button>Follow</button>
                </div>

              </div>

              <div className="tile">

                <div className="tile-label">
                  QUICK ACCESS
                </div>

                <div className="quick-grid">

                  <button>
                    <span>⌂</span>
                    Home
                  </button>

                  <button>
                    <span>▣</span>
                    My Roadmaps
                  </button>

                  <button>
                    <span>♡</span>
                    Saved
                  </button>

                  <button>
                    <span>◉</span>
                    Profile
                  </button>

                </div>

              </div>

            </div>
          )}

          {activeItem && (
            <div className="context-panel">

              <div className="context-label">
                {activeItem.type}
              </div>

              <h2>{activeItem.title}</h2>

              <div className="context-author">

                <div className="person-avatar">
                  {activeItem.author[0]}
                </div>

                <div>
                  <strong>{activeItem.author}</strong>
                  <p>Community member</p>
                </div>

              </div>

              <div className="context-actions">
                <button>♡ Like</button>
                <button>▣ Save</button>
                <button>↗ Share</button>
              </div>

              <div className="context-section">

                <h3>
                  {activeItem.type === "roadmap"
                    ? "Roadmap overview"
                    : "Discussion"}
                </h3>

                {activeItem.type === "roadmap" ? (
                  <>
                    <div className="roadmap-progress">

                      <div className="progress-info">
                        <span>Progress</span>
                        <strong>0%</strong>
                      </div>

                      <div className="progress-bar">
                        <div />
                      </div>

                    </div>

                    <div className="roadmap-nodes">

                      <div className="roadmap-node">
                        <span>01</span>
                        Fundamentals
                      </div>

                      <div className="roadmap-node">
                        <span>02</span>
                        Core Concepts
                      </div>

                      <div className="roadmap-node">
                        <span>03</span>
                        Projects
                      </div>

                      <div className="roadmap-node">
                        <span>04</span>
                        Advanced
                      </div>

                    </div>
                  </>
                ) : (
                  <div className="comments">

                    <div className="comment">
                      <div className="comment-avatar">R</div>

                      <div>
                        <strong>Rahul</strong>
                        <p>
                          This is a really interesting perspective.
                          I had the same experience.
                        </p>
                      </div>
                    </div>

                    <div className="comment">
                      <div className="comment-avatar">M</div>

                      <div>
                        <strong>Meera</strong>
                        <p>
                          Would love to see a follow-up on this.
                        </p>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              <button
                className="back-button"
                onClick={() => {
                  setActiveItem(null);
                  setRightPanel("discover");
                }}
              >
                ← Back to discover
              </button>

            </div>
          )}

        </aside>

      </main>
    </div>
  );
}

export default App;
