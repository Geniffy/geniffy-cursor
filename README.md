<p align="center">
  <a href="https://geniffy.com"><img src="https://geniffy.com/brand/geniffy-lockup-ink.png" alt="Geniffy" height="44"></a>
</p>

# Geniffy for Cursor

Cursor that remembers you and your projects. Each chat starts with what Geniffy knows that matters here, and
what you discuss is saved as you go: every fact with the line it came from, and a plain "nothing stored" instead
of a guess.

[![CI](https://github.com/Geniffy/geniffy-cursor/actions/workflows/ci.yml/badge.svg)](https://github.com/Geniffy/geniffy-cursor/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-docs.geniffy.com-1A1814)](https://docs.geniffy.com/mcp/cursor)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Install

From the Cursor Marketplace: search for **Geniffy** and choose **Install**.

Or from this repository, as a local plugin:

```bash
git clone https://github.com/Geniffy/geniffy-cursor ~/.cursor/plugins/local/geniffy
```

Then two sign-ins, each one click in the browser, with no key to copy:

1. **The memory tools.** The first time Cursor uses Geniffy it asks you to connect it (Cursor Settings, MCP).
   Sign in to Geniffy and choose **Allow**.
2. **Automatic memory.** Type `geniffy login` in a chat. Your browser opens on Geniffy; choose **Allow**.

The plugin's hooks run with Node.js 18 or later, so `node` needs to be on your `PATH`.

## What it does

| When | What happens |
| --- | --- |
| A chat starts | The agent gets a short summary: what lasts about you, what is going on now, and what was said before about this project |
| You send a message | It is kept on your computer until the turn ends |
| The turn ends | The exchange is saved to Geniffy in the background, who said what kept, so your words become facts about you and the agent's do not |
| The agent needs more | The memory tools that only read (`search`, `ask`, `fetch`, `profile`, `list_memories`) run without asking; saving, correcting and forgetting ask first |

Geniffy learns the facts in each exchange and keeps each one with the line it came from and when it was said. A
newer fact replaces an older one, and when nothing supports an answer, the agent is told to say so.

## Commands

Type these in a chat, or pick them from the commands list. The plugin answers them itself: they never reach the
model and are never saved.

| Command | |
| --- | --- |
| `geniffy login` | Sign in for automatic memory (once per computer) |
| `geniffy status` | Whether you're signed in, whether saving is on, and what was saved last |
| `geniffy pause`, `geniffy resume` | Stop or restart saving. Chats still start with what Geniffy remembers |
| `geniffy logout` | Sign out on this computer |

`/geniffy-remember` saves something on purpose, and `/geniffy-recall` asks your memory, with sources.

## What stays on your computer

- **Secrets.** API keys, tokens, passwords, connection-string passwords and private keys are removed before anything
  is saved, matched by shape (`sk-…`, `ghp_…`, `AKIA…`, `xoxb-…`, `password: …` and more).
- **Code.** Code blocks are left out: your repository holds your code, and the memory holds what was decided.
- **Commands.** The Geniffy commands aren't saved.
- **Everything, while paused.** `geniffy pause` stops saving until you resume.
- **The sign-in itself** lives in `~/.geniffy/cursor/`, readable only by you. `geniffy logout` ends it at Geniffy
  and deletes it here.

## One memory, in every app

This is the same memory you can connect to Claude Code, Claude.ai, ChatGPT, VS Code and Codex through the
[Geniffy MCP server](https://github.com/Geniffy/geniffy-mcp). See it, correct it or erase it at
[geniffy.com/app](https://geniffy.com/app).

## Develop

```bash
npm test     # node --test, no dependencies
```

Set `GENIFFY_API_URL` to point the scripts at another Geniffy server, and `GENIFFY_PLUGIN_HOME` to keep their
files somewhere other than `~/.geniffy/cursor`.

## Security

Report a vulnerability to ops@geniffy.com, not in a public issue. See the
[security policy](https://github.com/Geniffy/.github/blob/main/SECURITY.md).
