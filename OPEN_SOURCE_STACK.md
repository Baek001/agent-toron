# Open Source Stack

This project can use open source UI and agent tooling wherever it helps the MVP move faster.

## Current Phase

The current working preview is dependency-free under `mvp/` because package installation is slow in this Google Drive synced folder.

The Next.js scaffold is prepared to use these open source packages once dependencies install cleanly:

| Package | Use | License posture |
| --- | --- | --- |
| Next.js | React app framework | Open source package dependency |
| React / React DOM | UI runtime | Open source package dependency |
| Radix Slot | shadcn-style composition primitive | Open source package dependency |
| class-variance-authority | shadcn-style component variants | Open source package dependency |
| clsx / tailwind-merge | class composition helpers | Open source package dependency |
| lucide-react | interface icons | Open source package dependency |
| assistant-ui | future streaming/chat runtime for OpenClaw-backed conversations | Add in Phase 2 when package installation is stable |

## Reference Projects

- Magentic-UI: UX reference for transparent, human-in-the-loop agent work.
- AutoGen Studio: reference for multi-agent setup/workflow screens.
- LangSmith: reference for inspector/trace panels.

## Rules

- Prefer package dependencies or registry-installed components over copying large source trees.
- If code is copied or vendored, keep the license notice with it.
- Avoid GPL/AGPL UI dependencies for the MVP unless explicitly approved.
- Keep OpenClaw integration behind an adapter so UI libraries do not leak into runtime decisions.

