import { defineConfig, loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
    // .env 파일에서 환경 변수를 로딩합니다.
    const env = loadEnv(mode, process.cwd(), '');

    return {
        build: {
            sourcemap: true, // 소스 맵 생성 활성화
        },
        plugins: [
            sentryVitePlugin({
                org: env.SENTRY_ORG_SLUG,
                project: env.SENTRY_PROJECT_SLUG,
                authToken: env.SENTRY_AUTH_TOKEN,
            }),
        ],
    };
});
