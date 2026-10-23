/**
 * Size of one reference-script pricing tier, in bytes (`refScriptCostStride` in cardano-ledger).
 */
export const REF_SCRIPT_TIER_BYTES = BigInt( 25_600 );

/**
 * Conway minimum fee for the reference scripts of a transaction.
 *
 * The ledger does not charge a flat rate per byte. It splits the total reference-script size
 * into 25,600-byte tiers and multiplies the price by 1.2 for every tier after the first
 * (`tierRefScriptFee` in cardano-ledger-conway). The sum is kept as an exact fraction and
 * rounded down once at the end, as the ledger does.
 *
 * A flat rate is exact only up to the first tier; above it the builder underestimates the fee
 * and the node rejects the transaction with `FeeTooSmallUTxO`.
 *
 * @param totalBytes total size of all reference scripts the transaction uses
 * @param rate `minfeeRefScriptCostPerByte` as a fraction
 */
export function tieredRefScriptFee(
    totalBytes: bigint,
    rate: { num: bigint, den: bigint }
): bigint
{
    if( totalBytes <= BigInt( 0 ) ) return BigInt( 0 );

    // current tier price as num / den
    let num = rate.num;
    let den = rate.den;
    // accumulated fee as accNum / accDen
    let accNum = BigInt( 0 );
    let accDen = BigInt( 1 );
    let left = totalBytes;

    while( left > BigInt( 0 ) )
    {
        const chunk = left > REF_SCRIPT_TIER_BYTES ? REF_SCRIPT_TIER_BYTES : left;
        // acc += chunk * num / den
        accNum = accNum * den + chunk * num * accDen;
        accDen = accDen * den;
        left -= chunk;
        // price *= 6 / 5
        num = num * BigInt( 6 );
        den = den * BigInt( 5 );
    }

    return accNum / accDen;
}
