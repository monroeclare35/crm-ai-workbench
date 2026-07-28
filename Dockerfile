FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv curl && rm -rf /var/lib/apt/lists/*

# Claude Code CLI — SDK 的引擎
RUN npm install -g @anthropic-ai/claude-code --unsafe-perm 2>&1 || true
RUN which claude || (echo "Creating claude wrapper..." && \
    CLI_JS=$(find /usr/local/lib/node_modules/@anthropic-ai/claude-code -name "cli.js" 2>/dev/null | head -1) && \
    if [ -n "$CLI_JS" ]; then echo '#!/bin/sh' > /usr/local/bin/claude && echo "exec node $CLI_JS \"\$@\"" >> /usr/local/bin/claude && chmod +x /usr/local/bin/claude; fi) || true
RUN echo "claude path: $(which claude || echo NOT FOUND)"
RUN ls -la /usr/local/bin/claude 2>/dev/null || echo "no claude binary"
RUN ls /usr/local/lib/node_modules/@anthropic-ai/claude-code/ 2>/dev/null | head -5 || echo "no claude-code module"

RUN pip3 install --break-system-packages --no-cache-dir \
    claude-agent-sdk fastapi uvicorn

WORKDIR /app
COPY server.py .

ENV ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ENV ANTHROPIC_AUTH_TOKEN=sk-530763cc55cc4320b16089a9e9730a72
ENV ANTHROPIC_API_KEY=sk-530763cc55cc4320b16089a9e9730a72
ENV ANTHROPIC_MODEL=deepseek-v4-pro
ENV CLAUDE_CODE_SKIP_AUTH=1
ENV DISABLE_ANTHROPIC_OAUTH=1
ENV PYTHONIOENCODING=utf-8
ENV PORT=10000

EXPOSE 10000
RUN chown -R node:node /app
USER node
CMD ["python3", "server.py"]
