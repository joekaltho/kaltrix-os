import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-8xl font-black text-green-400 mb-4">404</div>
        <h1 className="text-3xl font-black mb-4">Page Not Found</h1>
        <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-green-400 hover:bg-green-300 text-black font-bold px-8 py-3 rounded-xl transition"
          >
            Go Home
          </Link>
          <Link
            href="/discover"
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl transition border border-gray-700"
          >
            Discover Businesses
          </Link>
        </div>
      </div>
    </div>
  )
}