import { Address, Script, ScriptType, Tx, TxBody, TxOut, TxOutRef, TxWitnessSet, UTxO, Value, defaultProtocolParameters } from "@harmoniclabs/cardano-ledger-ts";
import { TxBuilder } from "../TxBuilder";
import { tieredRefScriptFee } from "../utils/refScriptFee";
import { cborFromRational } from "../../utils/Rational";

const builder = new TxBuilder( defaultProtocolParameters );
const rate = cborFromRational( defaultProtocolParameters.minfeeRefScriptCostPerByte );

function script( size: number ): Script
{
    return new Script( ScriptType.PlutusV3, new Uint8Array( size ).fill( 1 ) );
}

// size as calcMinFee counts it
const counted = ( s: Script ) => BigInt( s.toCbor().length + 10 );

function utxo( idByte: string, refScript?: Script ): UTxO
{
    return new UTxO({
        utxoRef: new TxOutRef({ id: idByte.repeat( 32 ), index: 0 }),
        resolved: new TxOut({ address: Address.fake, value: Value.lovelaces( 50_000_000 ), refScript })
    });
}

function tx( inputs: UTxO[], refInputs?: UTxO[] ): Tx
{
    return new Tx({
        body: new TxBody({
            inputs: inputs as [UTxO, ...UTxO[]],
            refInputs,
            outputs: [ new TxOut({ address: Address.fake, value: Value.lovelaces( 10_000_000 ) }) ],
            fee: 0
        }),
        witnesses: new TxWitnessSet({})
    });
}

describe("calcMinFee reference-script fee", () => {

    test("a reference script on a spent input is charged", () => {
        const s = script( 2_000 );
        const without = builder.calcMinFee( tx([ utxo( "aa" ) ]) );
        const withScript = builder.calcMinFee( tx([ utxo( "aa", s ) ]) );
        expect( withScript - without ).toBe( tieredRefScriptFee( counted( s ), rate ) );
    });

    test("a reference script on a reference input is still charged", () => {
        const s = script( 2_000 );
        const without = builder.calcMinFee( tx([ utxo( "aa" ) ], [ utxo( "bb" ) ]) );
        const withScript = builder.calcMinFee( tx([ utxo( "aa" ) ], [ utxo( "bb", s ) ]) );
        expect( withScript - without ).toBe( tieredRefScriptFee( counted( s ), rate ) );
    });

    test("spent and reference inputs share one tiered total", () => {
        const a = script( 15_000 );
        const b = script( 15_000 );
        const without = builder.calcMinFee( tx([ utxo( "aa" ) ], [ utxo( "bb" ) ]) );
        const withScripts = builder.calcMinFee( tx([ utxo( "aa", a ) ], [ utxo( "bb", b ) ]) );
        const total = counted( a ) + counted( b );
        // the total crosses the first 25,600-byte tier, so separate sums would be too low
        expect( withScripts - without ).toBe( tieredRefScriptFee( total, rate ) );
        expect( withScripts - without ).toBeGreaterThan(
            tieredRefScriptFee( counted( a ), rate ) + tieredRefScriptFee( counted( b ), rate )
        );
    });

    test("a UTxO that is both spent and referenced counts once", () => {
        const s = script( 2_000 );
        const without = builder.calcMinFee( tx([ utxo( "aa" ) ], [ utxo( "aa" ) ]) );
        const withScript = builder.calcMinFee( tx([ utxo( "aa", s ) ], [ utxo( "aa", s ) ]) );
        expect( withScript - without ).toBe( tieredRefScriptFee( counted( s ), rate ) );
    });

    test("the same script on two spent inputs is counted twice", () => {
        const s = script( 2_000 );
        const without = builder.calcMinFee( tx([ utxo( "aa" ), utxo( "bb" ) ]) );
        const withScripts = builder.calcMinFee( tx([ utxo( "aa", s ), utxo( "bb", s ) ]) );
        expect( withScripts - without ).toBe( tieredRefScriptFee( BigInt( 2 ) * counted( s ), rate ) );
    });
});
