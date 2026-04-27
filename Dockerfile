FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4187 \
    OPENCLAW_PROFILE=debate \
    DEBATE_ENGINE_TIMEOUT_MS=90000 \
    OPENCLAW_TIMEOUT_MS=90000 \
    HOME=/home/node

ARG INSTALL_AI_CLIS=true

RUN if [ "$INSTALL_AI_CLIS" = "true" ]; then \
      npm install -g openclaw @openai/codex @anthropic-ai/claude-code; \
    fi \
    && npm cache clean --force

COPY package.json server.mjs ./
COPY mvp ./mvp

RUN mkdir -p /app/data/sessions /app/data/runtime-workspace /app/output/cli \
    /home/node/.openclaw-debate /home/node/.codex /home/node/.claude \
    && chown -R node:node /app /home/node

USER node

EXPOSE 4187

VOLUME ["/app/data", "/app/output", "/home/node/.openclaw-debate", "/home/node/.codex", "/home/node/.claude"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4187/api/status').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "mvp"]
