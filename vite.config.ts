import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * O build sai para o GitHub Pages, que serve o projeto em /UNICasterOverlay/.
 * O dev continua na raiz: só o build ganha o prefixo, e quem lê caminho de
 * manifesto usa import.meta.env.BASE_URL (ver src/assetUrl.ts).
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/UNICasterOverlay/' : '/',
  plugins: [react()],
  server: {
    // ffmpeg.wasm e WebCodecs multithread exigem cross-origin isolation.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}))
