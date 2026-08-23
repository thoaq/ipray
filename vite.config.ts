import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		}),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Gebetsraum',
				short_name: 'Gebetsraum',
				description: 'Deine Gebete, geordnet nach Kategorien — auch offline.',
				start_url: '/',
				display: 'standalone',
				background_color: '#F0F2ED',
				theme_color: '#F0F2ED',
				icons: [
					{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts',
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
						}
					}
				]
			}
		})
	]
});
