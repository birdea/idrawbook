import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/vite-env.d.ts', 'src/main.ts'], // Exclude main entry point as it's harder to unit test
            // thresholds: {
            //     statements: 90,
            //     branches: 90,
            //     functions: 90,
            //     lines: 90
            // }
        }
    }
})
