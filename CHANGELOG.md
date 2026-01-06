# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2024-12-19

### Added
- Initial release of ShellUI CLI tool
- `start` command to launch a development server with hot module replacement
- `build` command to create a production build of the shell application
- React-based microfrontend shell powered by Vite
- Configuration file support (`shellui.json`) with port configuration
- Legacy configuration file support (`shellioj.json`) for backward compatibility
- Automatic configuration injection into the shell application via `__SHELLUI_CONFIG__`
- Default port configuration (3000) when no config file is present
- Colored console output using picocolors for better CLI UX
- File system access controls for secure development server

