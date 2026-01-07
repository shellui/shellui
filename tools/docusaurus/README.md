# ShellUI Documentation Website

This directory contains the Docusaurus documentation website for ShellUI.

## Structure

- `docusaurus.config.js` - Main Docusaurus configuration
- `sidebars.js` - Sidebar configuration for documentation navigation
- `babel.config.js` - Babel configuration
- `src/` - React components and custom CSS
- `static/` - Static assets (images, fonts, etc.)
- `package.json` - Dependencies and scripts for the documentation site

## Documentation Source

The markdown documentation files are located in the `../../docs/` directory (two levels up from this directory). The Docusaurus configuration is set to load markdown files from there.

## Development

### Install Dependencies

```bash
npm install
```

Or from the root directory:

```bash
npm run docs:install
```

### Start Development Server

```bash
npm start
```

Or from the root directory:

```bash
npm run docs:start
```

This will start a local development server at `http://localhost:3000`.

### Build Documentation

```bash
npm run build
```

Or from the root directory:

```bash
npm run docs:build
```

### Serve Built Documentation

```bash
npm run serve
```

Or from the root directory:

```bash
npm run docs:serve
```

## Deployment

The documentation is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the main/master branch. See `.github/workflows/deploy-docs.yml` for the deployment configuration.


