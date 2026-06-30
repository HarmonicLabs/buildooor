import { Address, TxOutRef, TxOut, UTxO, Value } from "@harmoniclabs/cardano-ledger-ts";
import { keepRelevant } from "../keepRelevant";
import { ITxBuildInput } from "../../txBuild";

const POLICY = "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea";
const ASSET_NAME = "546f6b656e4d";
const ASSET_UNIT = POLICY + ASSET_NAME;

function mkInput( txHashByte: string, index: number, value: Value ): ITxBuildInput
{
    return {
        utxo: new UTxO({
            utxoRef: new TxOutRef({ id: txHashByte.repeat( 32 ), index }),
            resolved: new TxOut({
                address: Address.fake,
                value
            })
        })
    };
}

const adaInput = ( txHashByte: string, lovelaces: number | bigint, index: number = 0 ) =>
    mkInput( txHashByte, index, Value.lovelaces( lovelaces ) );

const assetInput = ( txHashByte: string, lovelaces: number, assetQty: number ) =>
    mkInput( txHashByte, 0, Value.fromUnits([
        { unit: "lovelace", quantity: lovelaces },
        { unit: ASSET_UNIT, quantity: assetQty }
    ]));

const refStr = ( input: ITxBuildInput ) =>
    input.utxo.utxoRef.id.toString() + "#" + input.utxo.utxoRef.index.toString();

describe("keepRelevant", () => {

    describe("lovelace-only requests", () => {

        // 10 x 100 ADA
        const wallet = Array.from({ length: 10 }, (_, i) =>
            adaInput( (i + 1).toString( 16 ).padStart( 2, "0" ), 100_000_000 )
        );

        test("does NOT select the whole wallet for a small request (Value input)", () => {
            const selected = keepRelevant( Value.lovelaces( 2_000_000 ), wallet );
            // 2 ADA requested + 5 ADA default minimum → a single 100 ADA input suffices
            expect( selected.length ).toBe( 1 );
        });

        test("same result for the ValueUnits array shape", () => {
            const selected = keepRelevant( Value.lovelaces( 2_000_000 ).toUnits(), wallet );
            expect( selected.length ).toBe( 1 );
        });

        test("same result for the legacy record shape", () => {
            const selected = keepRelevant( { lovelace: 2_000_000n } as any, wallet );
            expect( selected.length ).toBe( 1 );
        });

        test("same result for a Value from a foreign realm (instanceof fails, toUnits present)", () => {
            // simulates a duplicated cardano-ledger-ts in node_modules
            const foreignValue = {
                toUnits: () => Value.lovelaces( 2_000_000 ).toUnits()
            };
            const selected = keepRelevant( foreignValue as any, wallet );
            expect( selected.length ).toBe( 1 );
        });

        test("honors the requested lovelace amount, not just the minimum", () => {
            // 250 ADA requested + 5 ADA minimum → needs 3 of the 100 ADA inputs
            const selected = keepRelevant( Value.lovelaces( 250_000_000 ), wallet );
            const total = selected.reduce(
                ( sum, i ) => sum + new UTxO( i.utxo ).resolved.value.lovelaces,
                BigInt( 0 )
            );
            expect( selected.length ).toBe( 3 );
            expect( total >= 255_000_000n ).toBe( true );
        });

        test("respects a custom minimumLovelaceRequired", () => {
            const selected = keepRelevant( Value.lovelaces( 2_000_000 ), wallet, 150_000_000 );
            // 2 + 150 ADA → needs 2 inputs
            expect( selected.length ).toBe( 2 );
        });

        test("prefers smaller UTxOs first for the lovelace top-up", () => {
            const mixed = [
                adaInput( "aa", 100_000_000 ),
                adaInput( "bb", 3_000_000 ),
                adaInput( "cc", 5_000_000 ),
            ];
            // 1 ADA + 5 ADA min = 6 ADA → 3 + 5 = 8 ADA from the two small inputs
            const selected = keepRelevant( Value.lovelaces( 1_000_000 ), mixed );
            const ids = selected.map( refStr );
            expect( selected.length ).toBe( 2 );
            expect( ids ).toContain( refStr( mixed[1] ) );
            expect( ids ).toContain( refStr( mixed[2] ) );
        });

        test("returns everything when the wallet cannot cover the request", () => {
            const small = [ adaInput( "aa", 1_000_000 ), adaInput( "bb", 1_000_000 ) ];
            const selected = keepRelevant( Value.lovelaces( 100_000_000 ), small );
            expect( selected.length ).toBe( 2 );
        });
    });

    describe("multi-asset requests", () => {

        const wallet = [
            adaInput( "aa", 100_000_000 ),
            assetInput( "bb", 2_000_000, 5 ),
            adaInput( "cc", 100_000_000 ),
        ];

        test("selects the asset-bearing UTxO plus a lovelace top-up only as needed", () => {
            const requested = Value.fromUnits([
                { unit: "lovelace", quantity: 2_000_000 },
                { unit: ASSET_UNIT, quantity: 1 }
            ]);
            const selected = keepRelevant( requested, wallet );
            const ids = selected.map( refStr );

            // asset UTxO always kept; its 2 ADA < 7 ADA required → exactly one top-up input
            expect( ids ).toContain( refStr( wallet[1] ) );
            expect( selected.length ).toBe( 2 );
        });

        test("does not treat plain-ADA UTxOs as multi-asset matches", () => {
            const requested = Value.fromUnits([
                { unit: ASSET_UNIT, quantity: 1 }
            ]);
            const selected = keepRelevant( requested, wallet, 1_000_000 );
            const ids = selected.map( refStr );

            expect( ids ).toContain( refStr( wallet[1] ) );
            // asset UTxO already carries 2 ADA ≥ 1 ADA minimum → no extra inputs
            expect( selected.length ).toBe( 1 );
        });
    });

    test("deduplicates by full out-ref, not only by tx hash", () => {
        // two outputs of the SAME transaction: one holds the asset, one plain ADA
        const sameTxAsset = assetInput( "dd", 2_000_000, 5 );
        const sameTxAda = adaInput( "dd", 100_000_000, 1 );
        const wallet = [ sameTxAsset, sameTxAda ];

        const requested = Value.fromUnits([
            { unit: "lovelace", quantity: 50_000_000 },
            { unit: ASSET_UNIT, quantity: 1 }
        ]);
        const selected = keepRelevant( requested, wallet );
        const ids = selected.map( refStr );

        // the sibling output must remain available for the lovelace top-up
        expect( ids ).toContain( refStr( sameTxAsset ) );
        expect( ids ).toContain( refStr( sameTxAda ) );
        expect( selected.length ).toBe( 2 );
    });
});
