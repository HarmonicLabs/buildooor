# Changelog

## 0.2.10

Fixes found by three projects (Gravity, Mandala, Gerolamo) that were running patched builds of 0.2.9.

### Fees
- Conway tiered reference-script fee: reference scripts are priced in 25,600-byte tiers, 1.2x per tier, as `tierRefScriptFee` in cardano-ledger. 0.2.9 charged a flat rate, so transactions with more than one tier of reference scripts failed with `FeeTooSmallUTxO`.
- New optional `TxBuilder` constructor argument `{ feeMargin, exUnitsMargin }` (default 1, no change without it). The script fee is computed from the declared execution units.

### Building
- Native-script minting policies get no redeemer. 0.2.9 failed with "missing script for Mint redeemer N".
- `TxBuilderRunner.attachMemo` is registered; it was `undefined` at runtime.

### Script context (local evaluation now matches the ledger)
- Validity interval: the lower bound and infinite bounds are inclusive; the ttl is exclusive from protocol 9 (Conway). `getTxIntervalData` / `getTxInfos` take `upperBoundClosed` for earlier protocol versions.
- TxInfo redeemers are ordered by (tag, index).
- V1/V2 Rewarding purpose wraps the credential in `StakingHash`.

### Compatibility
No breaking API change: the new parameters are optional. Fees for transactions with large reference scripts rise to what the ledger requires.
