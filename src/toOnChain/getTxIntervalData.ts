import { Data, DataConstr, DataI } from "@harmoniclabs/plutus-data";
import { GenesisInfos, NormalizedGenesisInfos, isGenesisInfos, isNormalizedGenesisInfos, normalizedGenesisInfos } from "../TxBuilder/GenesisInfos";
import { unsafeForceUInt } from "../utils/ints";

/**
 * 
 * @param POSIX POSIX time in milliseconds
 * @param sysStartPOSIX blockchain start POSIX time in milliseconds
 * @param slotLenMs milliseconds per slot
 * @returns 
 */
export function POSIXToSlot( unixTime: number, gInfos: NormalizedGenesisInfos ): number
{
    const timePassed = unixTime - gInfos.systemStartPosixMs;
    const slotsPassed = Math.floor(timePassed / gInfos.slotLengthMs);
    return slotsPassed + gInfos.startSlotNo;
}

/**
 * 
 * @param slotN number of the slot
 * @param sysStartPOSIX blockchain start POSIX time in milliseconds
 * @param slotLenMs milliseconds per slot
 * @returns 
 */
export function slotToPOSIX( slot: number, gInfos: NormalizedGenesisInfos ): number
{
    const msAfterBegin = (slot - gInfos.startSlotNo) * gInfos.slotLengthMs;
    return gInfos.systemStartPosixMs + msAfterBegin;
}

/**
 * The validity interval as the ledger passes it to scripts.
 *
 * - The lower bound is always inclusive.
 * - Missing bounds (`NegInf` / `PosInf`) are inclusive.
 * - A finite upper bound (the ttl) is exclusive from protocol version 9 (Conway) on.
 *   Before that the ledger passed it as inclusive; pass `upperBoundClosed = true` to
 *   reproduce that.
 *
 * Plutus `Bool`: `False` is `Constr 0 []`, `True` is `Constr 1 []`.
 */
export function getTxIntervalData(
    startSlot: bigint | undefined,
    ttlSlot: bigint | undefined,
    geneisInfos: GenesisInfos | undefined,
    upperBoundClosed: boolean = false
): DataConstr
{
    geneisInfos = geneisInfos ? normalizedGenesisInfos( geneisInfos ) : undefined;
    let lowerBoundData: Data | undefined = undefined;

    if( startSlot === undefined )
    {
        lowerBoundData = new DataConstr( 0, [] ); // PNegInf 
    }
    else
    {
        if( !isNormalizedGenesisInfos( geneisInfos ) )
        {
            throw new Error("missing genesis infos requried to translate slot number to posix")
        }

        lowerBoundData = new DataConstr( // PExtended
            1, // PFinite
            [
                new DataI(
                    slotToPOSIX(
                        unsafeForceUInt( startSlot ),
                        geneisInfos
                    )
                )
            ]
        );
    }

    const endSlot = ttlSlot;
    
    let upperBoundData: Data | undefined = undefined;

    if( endSlot === undefined )
    {
        upperBoundData = new DataConstr( 2, [] ); // PPosInf 
    }
    else
    {
        if( !isNormalizedGenesisInfos( geneisInfos ) )
        {
            throw new Error("missing genesis infos requried to translate slot number to posix")
        }

        upperBoundData = new DataConstr( // PExtended
            1, // PFinite
            [
                new DataI(
                    slotToPOSIX(
                        unsafeForceUInt( endSlot ),
                        geneisInfos
                    )
                )
            ]
        );
    }

    return new DataConstr(
        0, // PPosixTimeRange (PInterval) only constructor
        [
            // from
            new DataConstr( // PBound
                0, // only constructor
                [
                    // bound
                    lowerBoundData,
                    // inclusive: always
                    new DataConstr( 1, [] ) // True
                ]
            ),
            // to
            new DataConstr( // PBound
                0, // only constructor
                [
                    // bound
                    upperBoundData,
                    // inclusive: PosInf always; a finite ttl only before Conway
                    new DataConstr( ( endSlot === undefined || upperBoundClosed ) ? 1 : 0, [] )
                ]
            ),
        ]
    );
}