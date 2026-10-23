//! Business module boundaries for the modular monolith.
//!
//! No business module is implemented in the architecture-initialisation phase.
//! Future modules live below this directory and keep the same internal shape:
//!
//! - `routes.rs` — HTTP handlers, extractors, status codes and `OpenAPI` paths
//! - `service.rs` — business rules and authorization decisions
//! - `repository.rs` — `SQLx` queries owned by this module
//! - `model.rs` / `dto.rs` — persistence models and API contracts
//! - `mod.rs` — module wiring and public surface
//!
//! Planned ownership:
//!
//! - `users` — accounts, profiles, credentials and sessions
//! - `rbac` — roles, permissions and policy checks
//! - `servers` — game server directory, status sync and online players
//! - `forum` — categories, topics, replies and moderation state
//! - `notifications` — in-app notifications and delivery preferences
//! - `moderation` — reports, review queues and enforcement actions
//! - `audit` — append-only administrative action records
//! - `settings` — system configuration with change history
//!
//! Modules must depend on shared infrastructure (database, Redis, errors,
//! authentication extractors) and must not reach into another module's
//! repository. Cross-module operations go through service interfaces.
