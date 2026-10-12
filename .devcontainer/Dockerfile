# Sandbox for running the Ralph loop (claude --dangerously-skip-permissions).
# Adapted from Anthropic's reference: github.com/anthropics/claude-code/tree/main/.devcontainer
FROM node:24-bookworm

ARG CLAUDE_CODE_VERSION=latest
ARG PLAYWRIGHT_VERSION=1.64.0

# Dev tools plus iptables/ipset for the outbound firewall.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git less procps sudo jq unzip iptables ipset iproute2 dnsutils aggregate \
    postgresql-client nano \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# System libraries Chromium needs (installed as root, at build time, before the firewall exists).
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/local/share/npm-global /workspace /home/node/.claude \
  && chown -R node:node /usr/local/share/npm-global /workspace /home/node/.claude

ENV DEVCONTAINER=true
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
# Login shells reset PATH from /etc/profile; re-add the npm global bin there too.
RUN echo 'export PATH=$PATH:/usr/local/share/npm-global/bin' > /etc/profile.d/npm-global.sh
WORKDIR /workspace

USER node
# The browser itself goes in node's cache; its version must match tests/characterization.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install chromium
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# The firewall script is the only thing node may run as root.
USER root
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall
USER node
