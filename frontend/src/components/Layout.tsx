import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight text-indigo-400">
            Tabletop Companion
          </span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink
            to="/campaigns"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            Campaigns
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
