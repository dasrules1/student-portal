/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'student.educationmore.com',
          },
        ],
        destination: '/student-portal/:path*',
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'staff.educationmore.com',
          },
        ],
        destination: '/staff-portal/:path*',
      },
    ]
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
