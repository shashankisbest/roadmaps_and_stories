export default function MainLayout({
  floatingNav,
  leftPanel,
  rightPanel,
}) {
  return (
    <div className="app">
      {floatingNav}
      <main className="workspace">
        {leftPanel}
        {rightPanel}
      </main>
    </div>
  );
}
