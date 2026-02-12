---
"@maplab/zapper": minor
---

Limit PM2 restart attempts for faster feedback in local development

- Configure PM2 with max_restarts: 2 instead of unlimited retries
- Set min_uptime: 4000ms so processes must stay up 4 seconds to count as successful
- Provides faster feedback when processes are crashing instead of showing them as perpetually "up"
- Updated documentation to reflect the new restart behavior