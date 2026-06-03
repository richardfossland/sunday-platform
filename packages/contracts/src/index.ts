/**
 * @sunday/contracts — canonical cross-app wire contracts for the Sunday suite.
 *
 * Every payload carries a `schema_version` (currently {@link SCHEMA_VERSION}).
 * Consumers MUST ignore unknown fields. The Rust crate `sunday-contracts` mirrors
 * these shapes; `fixtures/*.json` at the repo root is the single source of truth
 * both languages round-trip against.
 */
export * from "./common.js";
export * from "./song.js";
export * from "./usage.js";
export * from "./service.js";
export * from "./live.js";
export * from "./deeplink.js";
export * from "./bundle.js";
export * from "./mapping.js";
export * from "./recording.js";
export * from "./builders.js";
