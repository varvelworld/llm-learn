import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 构建时用相对路径 base('./'),这样部署到 GitHub Pages 的任意子路径
// (https://<用户>.github.io/<仓库>/)都能正确加载资源,不必关心仓库名。
// 本地开发(dev)仍用根路径 '/'。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}))
