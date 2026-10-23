import { Address, Hash28, Tx, TxBody, TxOut, TxRedeemer, TxRedeemerTag, TxWitnessSet, UTxO, Value } from "@harmoniclabs/cardano-ledger-ts";
import { DataB, DataConstr, DataI, DataMap } from "@harmoniclabs/plutus-data";
import { ExBudget } from "@harmoniclabs/plutus-machine";
import { fromAscii, toHex } from "@harmoniclabs/uint8array-utils";
import { getTxInfos } from "../getTxInfos";

// The ledger's TxInfo redeemers is a map keyed by script purpose, in the order of
// (tag, index): spend, mint, cert, reward, vote, propose. Not the witness-set order.
describe("getTxInfos: redeemers in ledger order", () => {

    const policyA = new Hash28( "aa".repeat( 28 ) );
    const policyB = new Hash28( "bb".repeat( 28 ) );

    const rdmr = ( index: number, n: number ) => new TxRedeemer({
        tag: TxRedeemerTag.Mint,
        index,
        data: new DataI( n ),
        execUnits: new ExBudget({ mem: 0, cpu: 0 })
    });

    const tx = new Tx({
        body: new TxBody({
            inputs: [ new UTxO({
                utxoRef: { id: "00".repeat( 32 ), index: 0 },
                resolved: { address: Address.fake, value: Value.lovelaces( 5_000_000 ) }
            }) ],
            outputs: [ new TxOut({ address: Address.fake, value: Value.lovelaces( 4_800_000 ) }) ],
            fee: 200_000,
            mint: Value.add(
                Value.singleAsset( policyA, fromAscii( "a" ), 1 ),
                Value.singleAsset( policyB, fromAscii( "b" ), 1 )
            )
        }),
        // witness set lists the second policy's redeemer first
        witnesses: new TxWitnessSet({ redeemers: [ rdmr( 1, 11 ), rdmr( 0, 10 ) ] })
    });

    test("v3 TxInfo lists mint redeemers by index", () => {
        const v3 = getTxInfos( tx, undefined ).v3 as DataConstr;
        const redeemers = v3.fields[9] as DataMap<DataConstr, DataI>;
        const hex = ( b: any ): string => b instanceof Uint8Array ? toHex( b ) : b.toString();
        const keys = redeemers.map.map( ({ fst }) => hex( ( fst.fields[0] as DataB ).bytes ) );
        expect( keys ).toEqual([ policyA.toString(), policyB.toString() ]);
        expect( redeemers.map.map( ({ snd }) => Number( snd.int ) ) ).toEqual([ 10, 11 ]);
    });

    test("the witness set itself is not reordered", () => {
        getTxInfos( tx, undefined );
        expect( tx.witnesses.redeemers!.map( r => r.index ) ).toEqual([ 1, 0 ]);
    });
});
