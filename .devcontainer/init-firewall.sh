#!/bin/bash
# Default-deny outbound firewall for the Ralph loop sandbox.
# Allowed: DNS, loopback, the compose network (legacy app, Postgres), and an allowlist of
# domains Claude Code and npm need. GitHub is deliberately NOT allowed: the loop commits
# locally and a human reviews and pushes from the host.
# Adapted from github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh
set -euo pipefail
IFS=$'\n\t'

# Keep Docker's embedded DNS (127.0.0.11) working: save its NAT rules before flushing.
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

if [ -n "$DOCKER_DNS_RULES" ]; then
  iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
  echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

# Required: the loop cannot work without these, so a resolution failure aborts.
REQUIRED_DOMAINS=(
  "api.anthropic.com"
  "registry.npmjs.org"
)
# Optional: login, telemetry and error reporting. Missing ones only warn.
OPTIONAL_DOMAINS=(
  "claude.ai"
  "console.anthropic.com"
  "platform.claude.com"
  "statsig.anthropic.com"
  "statsig.com"
  "sentry.io"
)

add_domain() {
  local domain="$1" required="$2" ips ip
  ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
  if [ -z "$ips" ]; then
    if [ "$required" = "yes" ]; then
      echo "ERROR: failed to resolve required domain $domain" >&2
      exit 1
    fi
    echo "WARN: could not resolve optional domain $domain, skipping"
    return
  fi
  while read -r ip; do
    if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
      echo "ERROR: invalid IP $ip for $domain" >&2
      exit 1
    fi
    ipset add -exist allowed-domains "$ip"
  done <<< "$ips"
  echo "Allowed $domain"
}

for d in "${REQUIRED_DOMAINS[@]}"; do add_domain "$d" yes; done
for d in "${OPTIONAL_DOMAINS[@]}"; do add_domain "$d" no; done

# The compose network (gateway /24) holds the legacy app and Postgres.
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
  echo "ERROR: failed to detect the container network gateway" >&2
  exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Compose network: $HOST_NETWORK"
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Verifying firewall..."
if curl --connect-timeout 5 -s https://example.com >/dev/null 2>&1; then
  echo "ERROR: reached https://example.com; firewall is not blocking" >&2
  exit 1
fi
if curl --connect-timeout 5 -s https://api.github.com/zen >/dev/null 2>&1; then
  echo "ERROR: reached api.github.com; GitHub should be blocked" >&2
  exit 1
fi
if ! curl --connect-timeout 5 -s -o /dev/null https://api.anthropic.com; then
  echo "ERROR: cannot reach api.anthropic.com" >&2
  exit 1
fi
echo "Firewall ready: example.com and GitHub blocked, Anthropic API reachable."
