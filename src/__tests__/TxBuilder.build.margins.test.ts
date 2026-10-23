import { Address, Hash28, Script, ScriptType, UTxO, Value, defaultProtocolParameters } from "@harmoniclabs/cardano-ledger-ts";
import { DataI } from "@harmoniclabs/plutus-data";
import { fromAscii, fromHex } from "@harmoniclabs/uint8array-utils";
import { TxBuilder, applyMargin, defaultMainnetGenesisInfos } from "..";

describe("TxBuilder options: fee and execution-unit margins", () => {

    const plutusPolicy = new Script( ScriptType.PlutusV3, fromHex( "0101002499" ) );
    const funds = new UTxO({
        utxoRef: { id: "aa".repeat( 32 ), index: 0 },
        resolved: { address: Address.fake, value: Value.lovelaces( 20_000_000 ) }
    });
    const collateral = new UTxO({
        utxoRef: { id: "bb".repeat( 32 ), index: 0 },
        resolved: { address: Address.fake, value: Value.lovelaces( 5_000_000 ) }
    });
    const args = {
        inputs: [ { utxo: funds } ],
        collaterals: [ collateral ],
        mints: [{
            value: {
                policy: new Hash28( plutusPolicy.hash.toBuffer() ),
                assets: [ { name: fromAscii( "tok" ), quantity: 1 } ]
            },
            script: { inline: plutusPolicy, redeemer: new DataI( 0 ) }
        }],
        changeAddress: Address.fake
    };
    const build = ( opts?: { feeMargin?: number, exUnitsMargin?: number } ) =>
        new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos, opts ).buildSync( args );

    test("applyMargin rounds up and leaves margin 1 exact", () => {
        expect( applyMargin( BigInt( 1000 ), 1 ) ).toBe( BigInt( 1000 ) );
        expect( applyMargin( BigInt( 1000 ), 1.2 ) ).toBe( BigInt( 1200 ) );
        expect( applyMargin( BigInt( 1001 ), 1.1 ) ).toBe( BigInt( 1102 ) ); // 1101.1 -> 1102
    });

    test("no options: same as before, options default to 1", () => {
        const b = new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos );
        expect( b.options ).toEqual({ feeMargin: 1, exUnitsMargin: 1 });
        // invalid values are ignored
        const c = new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos, { feeMargin: 0.5, exUnitsMargin: NaN } );
        expect( c.options ).toEqual({ feeMargin: 1, exUnitsMargin: 1 });
    });

    test("exUnitsMargin scales the declared units and the fee pays for them", () => {
        const plain = build();
        const margined = build({ exUnitsMargin: 1.5 });

        const u0 = plain.witnesses.redeemers![0].execUnits;
        const u1 = margined.witnesses.redeemers![0].execUnits;
        expect( u1.mem ).toBe( applyMargin( u0.mem, 1.5 ) );
        expect( u1.cpu ).toBe( applyMargin( u0.cpu, 1.5 ) );

        // the extra fee covers the extra declared units at the protocol prices
        const [ memPrice, cpuPrice ] = defaultProtocolParameters.executionUnitPrices as any;
        const price = ( p: any, n: bigint ) => typeof p === "number"
            ? BigInt( Math.floor( p * Number( n ) ) )
            : ( n * BigInt( p.num ?? p.numerator ) ) / BigInt( p.den ?? p.denominator );
        const extra = price( memPrice, u1.mem - u0.mem ) + price( cpuPrice, u1.cpu - u0.cpu );
        expect( margined.body.fee - plain.body.fee ).toBeGreaterThanOrEqual( extra - BigInt( 2 ) );
    });

    test("feeMargin scales the size-based minimum fee", () => {
        const b1 = new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos );
        const b2 = new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos, { feeMargin: 1.25 } );
        const tx = build();
        expect( b2.calcMinFee( tx ) ).toBe( applyMargin( b1.calcMinFee( tx ), 1.25 ) );
        // an explicit minimum still wins when it is higher
        expect( b2.calcMinFee( tx, 100_000_000 ) ).toBe( BigInt( 100_000_000 ) );
    });
});
