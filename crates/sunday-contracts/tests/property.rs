//! Property / invariant fuzz for the deep-link codec and the cross-app
//! idempotency-key formula — the Rust mirror of the TypeScript
//! `deeplink.property.test.ts`. The fixed-seed PRNG (mulberry32) and codepoint
//! pool match the TS suite, and the idempotency vector table is the SHARED
//! cross-language oracle: both languages assert the same `(input -> expected)`
//! pairs, so they provably agree byte-for-byte on edge inputs.
//!
//! Deterministic: seeded PRNG, no I/O, no clock. 500 iterations per property.

use sunday_contracts::{
    build_handoff_url, decode_component, encode_component, make_usage_idempotency_key,
    parse_handoff_url, MediaHandoff, MediaKind,
};

// ── deterministic PRNG (matches the TS mulberry32) ───────────────────────────
struct Rng(u32);
impl Rng {
    fn new(seed: u32) -> Self {
        Rng(seed)
    }
    fn next_f64(&mut self) -> f64 {
        let mut a = self.0;
        a = a.wrapping_add(0x6d2b_79f5);
        self.0 = a;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = (t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t))) ^ t;
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next_f64() * n as f64) as usize
    }
}

// Adversarial codepoints: unreserved chars, whitespace, url-significant ASCII,
// controls, latin-1, CJK, astral-plane emoji.
const POOL: &[&str] = &[
    "a", "Z", "9", "-", "_", ".", "~", " ", "&", "=", "?", "#", "%", "+", "/", ":", "\\", "\"",
    "'", "<", ">", "{", "}", "[", "]", "|", "@", "\t", "\n", "\r", "\u{0}", "\u{1f}", "æ", "ø",
    "å", "é", "ü", "ß", "中", "文", "字", "🎵", "🙏", "𝕊",
];

const WHITESPACE: &[&str] = &[" ", "\t", "\n", "\r"];

fn rand_str(rng: &mut Rng, min_len: usize, max_len: usize, exclude: &[&str]) -> String {
    let len = min_len + rng.below(max_len - min_len + 1);
    let mut out = String::new();
    for _ in 0..len {
        let mut ch = POOL[rng.below(POOL.len())];
        while exclude.contains(&ch) {
            ch = POOL[rng.below(POOL.len())];
        }
        out.push_str(ch);
    }
    out
}

const ITERS: usize = 500;

#[test]
fn codec_round_trips_adversarial_unicode() {
    let mut rng = Rng::new(0xc0ffee);
    for i in 0..ITERS {
        let s = rand_str(&mut rng, 0, 24, &[]);
        let round = decode_component(&encode_component(&s));
        assert_eq!(round, s, "iter {i}: input {s:?}");
    }
}

#[test]
fn encode_only_emits_url_safe_chars() {
    let mut rng = Rng::new(0x1234_abcd);
    for i in 0..ITERS {
        let s = rand_str(&mut rng, 0, 24, &[]);
        let enc = encode_component(&s);
        for c in enc.chars() {
            assert!(
                c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '~' | '%' | '-'),
                "iter {i}: {s:?} -> {enc} has unsafe char {c:?}"
            );
        }
        // spaces never become "+"
        if s.contains(' ') {
            assert!(!enc.contains('+'), "iter {i}: space became + in {enc}");
        }
    }
}

// ── handoff build -> parse identity ──────────────────────────────────────────

fn canonical_value(rng: &mut Rng) -> String {
    // exclude whitespace so trim() (parse's only scalar normalization) is a no-op
    let mut s = rand_str(rng, 1, 16, WHITESPACE);
    if s.trim().is_empty() {
        s = "x".to_string();
    }
    s
}

fn canonical_glossary(rng: &mut Rng) -> Vec<String> {
    let exclude = [" ", "\t", "\n", "\r", ","];
    let count = rng.below(5);
    let mut seen: Vec<String> = Vec::new();
    let mut out: Vec<String> = Vec::new();
    for i in 0..count {
        let mut term = rand_str(rng, 1, 8, &exclude);
        if term.trim().is_empty() {
            term = format!("t{i}");
        }
        let lower = term.to_lowercase();
        if seen.contains(&lower) {
            continue;
        }
        seen.push(lower);
        out.push(term);
    }
    out
}

fn rand_handoff(rng: &mut Rng) -> MediaHandoff {
    let opt = |rng: &mut Rng| -> Option<String> {
        if rng.next_f64() < 0.5 {
            Some(canonical_value(rng))
        } else {
            None
        }
    };
    let media_kind = {
        let r = rng.next_f64();
        if r < 0.33 {
            Some(MediaKind::Video)
        } else if r < 0.5 {
            Some(MediaKind::Audio)
        } else {
            None
        }
    };
    MediaHandoff {
        action: "import".to_string(),
        path: canonical_value(rng),
        media_kind,
        language: opt(rng),
        context: opt(rng),
        glossary: canonical_glossary(rng),
        service_id: opt(rng),
        church_id: opt(rng),
        return_to: opt(rng),
    }
}

#[test]
fn handoff_build_then_parse_is_identity() {
    let mut rng = Rng::new(0xbada55);
    for i in 0..ITERS {
        let h = rand_handoff(&mut rng);
        let url = build_handoff_url("sundayedit", &h);
        let back = parse_handoff_url(&url, "sundayedit")
            .unwrap_or_else(|e| panic!("iter {i}: parse failed for {url}: {e}"));
        assert_eq!(back, h, "iter {i}: url {url}");
    }
}

// ── idempotency-key cross-language parity oracle ─────────────────────────────
// Identical (service_id, service_item_id, expected) triples to the TS
// IDEMPOTENCY_VECTORS table. If TS and Rust ever diverge on the formula, exactly
// one side fails.
#[test]
fn usage_key_parity() {
    let vectors: &[(&str, &str, &str)] = &[
        ("svc-9", "1", "svc-svc-9:item-1"),
        ("", "", "svc-:item-"),
        ("a:b", "c:d", "svc-a:b:item-c:d"),
        ("x", ":item-y", "svc-x:item-:item-y"),
        ("æøå", "中文", "svc-æøå:item-中文"),
        (
            "33333333-3333-3333-3333-333333333333",
            "0",
            "svc-33333333-3333-3333-3333-333333333333:item-0",
        ),
    ];
    for (svc, item, expected) in vectors {
        assert_eq!(&make_usage_idempotency_key(svc, item), expected);
    }
}
