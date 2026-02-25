import { defineConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
    build: {
        sourcemap: true, // 소스 맵 생성 활성화
    },
    plugins: [
        sentryVitePlugin({
            org: "o442414",
            project: "javascript-react-idrawbook",
            authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
    ],
});
