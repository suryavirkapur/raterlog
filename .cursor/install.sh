#!/usr/bin/env bash
# Idempotent setup for the Raterlog development environment.
# Installs backing services (PostgreSQL, Cassandra, MailHog), the Rust toolchain,
# Bun, and refreshes the web + api project dependencies. Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JDK17="/usr/lib/jvm/java-17-openjdk-amd64"
export DEBIAN_FRONTEND=noninteractive

echo "==> Configuring Apache Cassandra apt repository"
if [ ! -f /etc/apt/sources.list.d/cassandra.list ]; then
  curl -fsSL https://downloads.apache.org/cassandra/KEYS \
    | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/cassandra.gpg
  echo "deb [signed-by=/etc/apt/trusted.gpg.d/cassandra.gpg] https://debian.cassandra.apache.org 50x main" \
    | sudo tee /etc/apt/sources.list.d/cassandra.list >/dev/null
fi

echo "==> Installing system packages (PostgreSQL, JDK 17, Cassandra)"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  postgresql postgresql-contrib openjdk-17-jdk-headless cassandra

echo "==> Installing MailHog (captures invite emails over SMTP)"
if [ ! -x /usr/local/bin/mailhog ]; then
  sudo curl -fsSL -o /usr/local/bin/mailhog \
    https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64
  sudo chmod +x /usr/local/bin/mailhog
fi

# The api depends on crates that require edition2024, which needs Rust >= 1.85.
echo "==> Ensuring an up-to-date stable Rust toolchain"
rustup default stable
rustup update stable

echo "==> Installing Bun"
if [ ! -x "$HOME/.bun/bin/bun" ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$PATH"

echo "==> Installing web dependencies and generating Prisma client"
cd "$REPO_ROOT/web"
bun install
bunx prisma generate

echo "==> Building the Rust API"
cd "$REPO_ROOT/api"
cargo build

echo "==> Install complete (JDK17 at ${JDK17})"
