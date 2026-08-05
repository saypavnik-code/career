// escada-pages-v9: deterministic static export from the current main commit.
/** @type {import('next').NextConfig} */
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isUserSite = repository.endsWith('.github.io')
const basePath = isGitHubActions && repository && !isUserSite ? `/${repository}` : ''

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
}

export default nextConfig
