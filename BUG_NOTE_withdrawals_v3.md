# Bug: V3 script context wraps withdrawal credentials as `StakingCredential` instead of `Credential`

## TL;DR

`getTxInfos` produces a Plutus V3 script context whose `tx.withdrawals` is `Map<StakingCredential, int>` (V1/V2 shape) instead of `Map<Credential, int>` (V3 shape). Any V3 validator that pattern-matches the withdrawal key as a `Credential` will see `Constr 0 [Constr 1 [bytes]]` and either fall through to the wrong `pmatch` branch or fail equality checks against the rewarding-purpose's `stakeCredential` (which IS produced unwrapped).

This was hit while wiring `GravityAccount.swap` (which performs a `withdraw 0` from a script credential): the on-chain account validator's spending branch does

```ts
pmatch( tx.withdrawals.head.fst )
.onPScriptCredential(({ valHash }) => valHash.eq( ownHash ))
.onPPubKeyCredential(() => perror( bool ))
```

With the wrapped data the outer constructor is tag 0, which `pmatch` reads as `PPubKeyCredential` → `perror`.

## Where to fix

The bug is in this file (and only this file):

- `src/toOnChain/getTxInfos.ts` line 153 (and the similarly named `.js` in `dist`)

Currently:

```ts
// withderawals
tx.withdrawals?.toData( "v3" ) ?? new DataMap([]),
```

`TxWithdrawals.toData(version)` in `cardano-ledger-ts` calls
`rewardAccount.toStakeCredentials().toData(version)` for each entry, and
`StakeCredentials.toData("v3")` deliberately wraps in `DataConstr(0, [credData])`
(the `PStakingHash` shape). That wrapping is **correct** for `Address.stakeCreds`
in V3 — Plutus V3 `Address.stakingCredential` is still `Maybe<StakingCredential>`
— but it is **wrong** for `tx.withdrawals` which V3 changed to `Map<Credential, int>`.

So **do not** change `StakeCredentials.toData` in cardano-ledger-ts (it would
break addresses). Instead change buildooor's V3 path to emit the credential
unwrapped, e.g.:

```ts
// withdrawals — V3 uses Map<Credential, int> (no StakingCredential wrapper)
new DataMap(
    tx.withdrawals?.map.map( ({ rewardAccount, amount }) =>
        new DataPair(
            rewardAccount.toCredential().toData( "v3" ),
            new DataI( amount )
        )
    ) ?? []
),
```

(`StakeAddress.toCredential()` already exists and returns a plain `Credential`
that serialises as `Constr 0 [bytes]` / `Constr 1 [bytes]`.)

The V1 and V2 paths (lines 75 and 113 of `getTxInfos.ts`) are correct as-is and
must keep using `toStakeCredentials().toData()`.

## How to reproduce

Any tx with a withdraw-0 from a script credential whose on-chain validator
pattern-matches the withdrawal key as a `PCredential`. The `GravityAccount.swap`
path in `gravity-sdk` exercises this — it builds a tx with one script-credential
withdrawal whose redeemer is `AccountSwap`, and the spending branch of the
account validator runs first and rejects the wrapped key.

Symptom in evaluator output:

```
script '<account-script-hash>' consumed with Spend redemer and index 'N'
...
failed with
  error message: explicit error from uplc
  additional infos: undefined
  script execution logs: []
```

(Empty logs because the failure is the `perror` on the unexpected
`PPubKeyCredential` branch, not a `ptraceError`.)

## Verification

The fix should be regression-tested against:

1. A V1/V2 tx with a withdraw — withdrawal key must remain wrapped
   (`Constr 0 [Constr 1 [bytes]]`).
2. A V3 tx with a withdraw — withdrawal key must be unwrapped
   (`Constr 1 [bytes]` for script, `Constr 0 [bytes]` for keyhash).
3. A V3 tx with an `Address` whose `stakeCreds` is set — the address's
   `stakingCredential` field must remain wrapped (`Just (StakingHash …)`),
   confirming `StakeCredentials.toData("v3")` is unchanged.

## Workaround (if you can't patch buildooor)

In a vendored / patched build, the same fix can be applied directly to
`dist/toOnChain/getTxInfos.js` line 153 by replacing the call with the inline
`DataMap` construction shown above.
