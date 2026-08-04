// career-os-product-v4: static export for GitHub Pages
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isProjectPages = process.env.GITHUB_ACTIONS === 'true' && repository && !repository.endsWith('.github.io')
const basePath = isProjectPages ? `/${repository}` : ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
}

export default nextConfig
