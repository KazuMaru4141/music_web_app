import NowPlaying from '@/components/NowPlaying';
import Curator from '@/components/Curator';

export default function Home() {

  return (
    <main className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 border-r border-gray-900 p-6 flex flex-col hidden md:flex">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-8">
          DeepDive
        </h1>

        <nav className="space-y-4 flex-1">
          <a href="#" className="block p-3 rounded-lg bg-gray-900 text-white font-medium">Dashboard</a>
          <a href="#" className="block p-3 rounded-lg text-gray-400 hover:bg-gray-900 hover:text-white transition">Curator</a>
          <a href="#" className="block p-3 rounded-lg text-gray-400 hover:bg-gray-900 hover:text-white transition">Stats</a>
        </nav>

        <div className="pt-6 border-t border-gray-900">
          <a href="/api/auth/login" className="block w-full text-center py-2 bg-green-600 rounded-lg font-bold text-sm hover:bg-green-500 transition">
            Login with Spotify
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-3 md:p-8 overflow-y-auto">
        {/* Removed Dashboard Header for cleaner look */}

        <section className="mb-6 md:mb-12">
          <NowPlaying />
        </section>

        <section>
          <Curator />
        </section>

        <section>
          <h3 className="text-xl font-bold mb-4 text-gray-300">Quick Curator</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Genre Cards */}
            {['Power Pop', 'Mellow Pop', 'Indie Rock', 'Emo'].map((genre) => (
              <div key={genre} className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-500 cursor-pointer transition group">
                <div className="text-lg font-bold group-hover:text-blue-400">{genre}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
