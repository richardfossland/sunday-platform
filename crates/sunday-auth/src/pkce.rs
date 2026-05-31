//! PKCE (RFC 7636) — Proof Key for Code Exchange.
//!
//! Used by the desktop Sunday-ID login (Supabase Authorization-Code-with-PKCE
//! over a loopback redirect) and any other PKCE OAuth flow. The challenge
//! derivation is pure (verified against the RFC 7636 test vector); verifier
//! generation is a thin wrapper over the OS RNG, kept separate so the encoding
//! stays unit-tested without randomness.

use sha2::{Digest, Sha256};

/// base64url (RFC 4648 §5) with no padding — the alphabet PKCE and JWTs use.
fn base64url_nopad(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(ALPHABET[((n >> 18) & 0x3f) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[((n >> 6) & 0x3f) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(n & 0x3f) as usize] as char);
        }
    }
    out
}

/// A code verifier from raw entropy: base64url-nopad of the bytes. 32 bytes →
/// the recommended 43-char verifier. Pure, so the RNG can be tested separately.
pub fn code_verifier_from_bytes(bytes: &[u8]) -> String {
    base64url_nopad(bytes)
}

/// Generate a fresh 43-character code verifier from the OS CSPRNG.
pub fn generate_code_verifier() -> Result<String, getrandom::Error> {
    let mut buf = [0u8; 32];
    getrandom::getrandom(&mut buf)?;
    Ok(code_verifier_from_bytes(&buf))
}

/// The S256 code challenge for a verifier: base64url-nopad(SHA-256(verifier)).
pub fn code_challenge_s256(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    base64url_nopad(&digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_rfc7636_test_vector() {
        // RFC 7636 Appendix B.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            code_challenge_s256(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn base64url_has_no_padding_or_plus_slash() {
        let enc = base64url_nopad(&[0xfb, 0xff, 0xfe]);
        assert!(!enc.contains('='));
        assert!(!enc.contains('+'));
        assert!(!enc.contains('/'));
        // 3 bytes → exactly 4 chars.
        assert_eq!(enc.len(), 4);
    }

    #[test]
    fn verifier_from_32_bytes_is_43_chars() {
        let v = code_verifier_from_bytes(&[0u8; 32]);
        assert_eq!(v.len(), 43);
        // Only unreserved PKCE chars.
        assert!(v
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_')));
    }

    #[test]
    fn generated_verifier_is_well_formed() {
        let v = generate_code_verifier().expect("OS RNG");
        assert_eq!(v.len(), 43);
        // A generated verifier produces a stable challenge.
        assert_eq!(code_challenge_s256(&v), code_challenge_s256(&v));
    }

    #[test]
    fn empty_input_encodes_to_empty() {
        assert_eq!(base64url_nopad(&[]), "");
    }
}
