# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Build stage. Compilation tools stay in this stage only.
# ---------------------------------------------------------------------------
FROM rust:1.97.1-slim-bookworm AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

ENV CARGO_TERM_COLOR=never \
    CARGO_INCREMENTAL=0

# Cache dependency compilation before copying application sources.
COPY Cargo.toml Cargo.lock ./
COPY migrations ./migrations
RUN mkdir -p src/bin \
    && printf 'fn main() {}\n' > src/main.rs \
    && printf '// dependency cache placeholder\n' > src/lib.rs \
    && printf 'fn main() {}\n' > src/bin/migrate.rs \
    && cargo build --release --locked --bins \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs src/lib.rs src/bin/migrate.rs \
    && cargo build --release --locked --bins

# ---------------------------------------------------------------------------
# Runtime stage — Debian slim, non-root, two binaries (API + migrator).
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder /app/target/release/threi-api /app/threi-api
COPY --from=builder /app/target/release/migrate /app/migrate

USER 10001:10001
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["curl", "-fsS", "http://127.0.0.1:8080/health/ready"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/threi-api"]
