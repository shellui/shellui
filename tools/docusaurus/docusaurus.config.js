// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.vsDark;
const {MANIFEST_PATH} = require('./services');
const remarkServiceLinks = require('./plugins/remark-service-links');

/**
 * Service docs (identity, storage, hosting, email) live in their own repos.
 * `scripts/fetch-service-docs.js` resolves them and writes a manifest. When the
 * manifest is missing, for example after a fresh clone, run the fetch here so
 * `docusaurus start` and `docusaurus build` work on their own.
 */
function loadServiceManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    execFileSync(process.execPath, [path.join(__dirname, 'scripts/fetch-service-docs.js')], {
      stdio: 'inherit',
    });
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const service of manifest.services) {
    if (!fs.existsSync(service.docsPath)) {
      throw new Error(
        `Docs for ${service.id} are missing at ${service.docsPath}. Run \`pnpm docs:fetch\` again.`,
      );
    }
  }
  return manifest;
}

/**
 * First sidebar id declared in a service's sidebars file, used by the navbar.
 * @param {string} sidebarPath
 */
function firstSidebarId(sidebarPath) {
  delete require.cache[require.resolve(sidebarPath)];
  const sidebars = require(sidebarPath);
  const ids = Object.keys(sidebars || {});
  if (ids.length === 0) {
    throw new Error(`${sidebarPath} does not declare any sidebar`);
  }
  return ids[0];
}

const serviceManifest = loadServiceManifest();
const services = serviceManifest.services.map((service) => ({
  ...service,
  sidebarId: firstSidebarId(service.sidebarPath),
}));

const hostRoutes = Object.fromEntries(
  services.map((service) => [service.legacyHost, `/${service.routeBasePath}`]),
);

const servicePlugins = services.map((service) => {
  const ref = service.mode === 'remote' && service.ref ? service.ref : 'main';
  return [
    '@docusaurus/plugin-content-docs',
    /** @type {import('@docusaurus/plugin-content-docs').Options} */
    ({
      id: service.id,
      path: service.docsPath,
      routeBasePath: service.routeBasePath,
      sidebarPath: service.sidebarPath,
      // Edits always target main, even when the build pinned a tag or commit.
      editUrl: ({docPath}) => `https://github.com/${service.repo}/edit/main/docs/${docPath}`,
      beforeDefaultRemarkPlugins: [
        [
          remarkServiceLinks,
          {docsPath: service.docsPath, repo: service.repo, ref, hostRoutes},
        ],
      ],
    }),
  ];
});

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Shellui',
  tagline: 'A lightweight microfrontend shell to ship apps faster',
  favicon: 'img/favicon.ico',
  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/img/favicon-32x32.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/img/favicon-16x16.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/img/apple-touch-icon.png',
      },
    },
  ],

  // Set the production url of your site here
  url: 'https://docs.shellui.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'shellui', // Usually your GitHub org/user name.
  projectName: 'shellui', // Usually your repo name.

  // Broken links fail the build, including links inside service docs and
  // links between the main docs and service docs.
  onBrokenLinks: 'throw',
  // Two docs instances must never claim the same URL.
  onDuplicateRoutes: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  clientModules: [
    require.resolve('./src/shellui-init.js'),
  ],

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../../docs',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/shellui/shellui/tree/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [...servicePlugins],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: '',
        hideOnScroll: false,
        logo: {
          alt: 'Shellui documentation',
          src: 'img/shellui_documentation_logo.png',
          href: '/',
          height: 28,
          width: 257,
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
            className: 'navbar__docs-link',
          },
          ...(services.length > 0
            ? [
                {
                  type: 'dropdown',
                  label: 'Services',
                  position: 'left',
                  items: services.map((service) => ({
                    type: 'docSidebar',
                    docsPluginId: service.id,
                    sidebarId: service.sidebarId,
                    label: service.label,
                  })),
                },
              ]
            : []),
          {
            href: 'https://shellui.com',
            label: 'Shellui.com',
            position: 'left',
            className: 'navbar__mobile-only-link',
          },
          {
            href: 'https://github.com/shellui',
            label: 'GitHub',
            position: 'left',
            className: 'navbar__mobile-only-link',
          },
        ],
      },
      footer: {
        style: 'light',
        copyright: `© ${new Date().getFullYear()} Shellui. All rights reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;


