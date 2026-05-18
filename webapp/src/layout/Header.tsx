export function Header({
  sidebarOpen,
  onSidebarToggle,
}: {
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}) {
  return (
    <header className="bg-gray-800 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="md:hidden p-1 hover:bg-gray-700 rounded"
          aria-expanded={sidebarOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/blackboxnet.png" alt="BlackBoxMesh" className="h-12 w-auto brightness-110 contrast-110" />
        <h1 className="text-2xl font-bold">BlackBoxMesh</h1>
      </div>
    </header>
  );
}
