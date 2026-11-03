# Changelog

All notable changes to godot-correctness-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed

- `lint_file` now resolves the config from the nearest `godot-correctness.config.json` or `project.godot` at or above the file's directory, so subfolder files lint with the project config and report paths relative to that root, matching `lint_project`

## [0.1.1] - 2026-11-03

### Changed

- Publish via npm trusted publishing (OIDC) from `publish.yml`; first publish validates the trusted publisher connection

## [0.1.0] - 2026-07-19

### Added

- Initial project scaffold
- CI/CD workflows (ci, release, publish, drift-check, pages, stale, label-sync)
- GitHub Pages documentation site
