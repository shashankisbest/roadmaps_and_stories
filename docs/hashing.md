# Comment content hashing

## What hashing is

A cryptographic hash maps input data to a fixed-size fingerprint. The fingerprint
can be recalculated later to check whether the input still matches, but it does
not provide a way to recover the original input.

## Why SHA-256

The project uses SHA-256 from Python's standard `hashlib` library. It is
cryptographically strong for detecting accidental or unauthorized content
changes in this basic design, produces a fixed 32-byte digest, and needs no
additional dependency.

## Generation, storage, and edits

The backend calculates a 64-character lowercase hexadecimal digest from each
comment's stored `body`, encoded as UTF-8. The hash is over the exact stored
string: no Unicode normalization or line-ending conversion is performed.
Comment creation retains its existing input behavior, which trims surrounding
whitespace before saving; the resulting stored text is what gets hashed.
Clients cannot select the hash, and comment API responses do not include it.

Every model save that writes the comment body recalculates the fingerprint,
including saves with `update_fields=["body"]`, so a content edit replaces the
old hash. Saves that do not write the body leave its fingerprint unchanged.
The existing project does not currently expose a comment-edit API. Existing
comment rows are backfilled from their current stored content by migration
`comments.0002_comment_content_hash`.

## On-demand verification

An authenticated client can call `GET /api/comments/<id>/verify/`. The endpoint
only considers non-deleted comments on public posts, recalculates the hash from
the stored content, checks the stored value's format, and compares the values
with `hmac.compare_digest`. It returns only `{"valid": true}` when they match
and `{"valid": false}` otherwise. Missing comments are returned as not found.
Verification is read-only: it does not repair or regenerate a hash.

The frontend performs no hashing and does not verify comments during normal
comment loading. A user can request a check from the comment interface while
authenticated.

## Duplicate comments and limitations

Duplicate comments are allowed. Identical stored text has identical hashes;
the fingerprint is not a uniqueness constraint and does not identify a
particular comment.

Hashing is not encryption: it does not hide comment content. This design also
does not make database records tamper-proof. An attacker who can change both a
comment and its stored hash can bypass this integrity check. Possible future
improvements include an HMAC key stored outside the database or protected,
append-only audit logs.
