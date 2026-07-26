import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Reviewer Lib',
    description:
        'AI code review for pull requests — structured, actionable findings via a library, a CLI, or a GitHub Action.',
    lang: 'en-US',
    // Deployed under the GitHub Pages project subpath.
    base: '/reviewer-lib/',
    lastUpdated: true,
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'CLI', link: '/guide/cli' },
            { text: 'GitHub Action', link: '/guide/github-action' },
            { text: 'Recipes', link: '/guide/recipes' },
            { text: 'API', link: '/api' },
        ],
        sidebar: {
            '/': [
                {
                    text: 'Guide',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'CLI', link: '/guide/cli' },
                        { text: 'GitHub Action', link: '/guide/github-action' },
                        { text: 'Models & false positives', link: '/guide/models' },
                        { text: 'Recipes', link: '/guide/recipes' },
                    ],
                },
                {
                    text: 'Reference',
                    items: [{ text: 'API', link: '/api' }],
                },
            ],
        },
        socialLinks: [
            { icon: 'github', link: 'https://github.com/JuliettKhar/reviewer-lib' },
        ],
        search: { provider: 'local' },
        editLink: {
            pattern: 'https://github.com/JuliettKhar/reviewer-lib/edit/master/docs/:path',
            text: 'Edit this page on GitHub',
        },
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © Julia Kharlamova',
        },
    },
});
