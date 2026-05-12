<div align="center">
  <h1>LLM Gateway</h1>
  <p><strong>Anthropic-native routing proxy for multi-backend LLM access</strong></p>
  <p>Route requests by exact model name — no format conversion, no fuzzy matching.</p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
    <img src="https://img.shields.io/badge/platform-Windows-lightgrey" alt="Platform">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js">
  </p>
</div>

---

## Why

Running Claude Code through CC Switch to DeepSeek is smooth — until you need a local multimodal model for vision tasks. That's where routing breaks: CC Switch points to one backend, and you're stuck.

LLM Gateway sits between CC Switch and your LLM backends. It receives every request in native Anthropic format, matches the model name against your route table, and forwards to the right provider. No format conversion, no intermediate protocol — the exact same request body goes straight to DeepSeek or LM Studio.

## How it works

```
Claude Code → CC Switch → LLM Gateway (:3456) → DeepSeek    (reasoning, coding)
                                               → LM Studio   (vision, local models)
```

Every request keeps the same model name end-to-end. The gateway just matches it.

| Layer | Component | Role |
|-------|-----------|------|
| 1 | Claude Code | Sends requests. Model names come from CC Switch mapping |
| 2 | CC Switch | Intercepts, rewrites model name, forwards to gateway |
| 3 | LLM Gateway | Matches model name **exactly** → routes to the right provider |
| 4 | DeepSeek / LM Studio | Processes the request |

No fuzzy matching. No "smart" fallback. If the model name doesn't match a route entry, the gateway returns an error — you decide what goes where.

## Features

- **Exact-match routing** — a one-to-one mapping from model name to provider. What you see is what you get.
- **Anthropic format, end to end** — no conversion layer, no proxy translation. Both DeepSeek and LM Studio speak Anthropic natively.
- **System tray launcher** — double-click to start, icon in tray, right-click to exit. No terminal window needed.
- **Web admin panel** — manage providers and routes from a browser. Add a route, click "test", see a real request go through.
- **Honest testing** — the test button on each route sends a live request through the complete chain. If the provider rejects your model name, you see the error — not a fabricated "passed."
- **Pluggable providers** — DeepSeek and LM Studio ship as defaults. Add any OpenAI-compatible or Anthropic-compatible backend.

## Quick start

**1. Start the gateway**

Double-click `start-tray.vbs` — the gateway starts minimized, and a tray icon appears. Open your browser to `http://localhost:3456`.

**2. Add your DeepSeek key**

In the admin panel, paste your DeepSeek API key into the DeepSeek provider field. Click **Save**.

**3. Configure CC Switch**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3456/v1",
    "ANTHROPIC_AUTH_TOKEN": "<gateway API key from admin panel>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "DeepSeek-V4-Pro[1m]"
  }
}
```

**4. Route your vision requests**

In CC Switch, map a model to `qwen-vision` (or any name containing your configured pattern). The gateway sends it to LM Studio.

## Admin panel

| Section | What it does |
|---------|-------------|
| **Gateway** | Port and API key (the key CC Switch uses) |
| **Providers** | Backend services. Each has a name, base URL, and API key |
| **Routes** | Exact model name → target provider mappings |

### Testing a route

Every route has a **test** button. Click it and the gateway:
1. Saves your current config
2. Sends a real request through the full chain with the exact model name
3. Shows the response — success or the actual error

## Use cases

- **Claude Code + DeepSeek with vision fallback** — use DeepSeek for coding, LM Studio with Qwen for screenshots
- **Multi-model workflows** — route different model names to different providers from one CC Switch configuration
- **Local-first development** — test with local models, switch to remote when ready, without changing your Claude Code config

## Files

```
llm-gateway/
├── index.js           # Gateway
├── admin.html         # Admin panel
├── start-tray.vbs     # System tray launcher (double-click)
├── start-tray.ps1     # PowerShell tray script
├── start.bat          # Foreground mode (fallback)
├── .gitignore
├── README.md
└── package.json
```

## License

MIT
