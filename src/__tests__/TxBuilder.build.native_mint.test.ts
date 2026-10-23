import { Address, Hash28, Script, ScriptType, TxRedeemerTag, UTxO, Value, defaultProtocolParameters, nativeScriptToCbor } from "@harmoniclabs/cardano-ledger-ts";
import { DataI } from "@harmoniclabs/plutus-data";
import { fromAscii, fromHex } from "@harmoniclabs/uint8array-utils";
import { TxBuilder, defaultMainnetGenesisInfos } from "..";

// Native scripts are checked in phase 1 only. A native minting policy must not get a
// Plutus mint redeemer: the builder used to add one and then fail with
// "missing script for Mint redeemer N".
describe("minting with a native script policy", () => {

    const nativePolicy = new Script(
        ScriptType.NativeScript,
        nativeScriptToCbor({
            type: "sig",
            keyHash: "814a30098be2b6f01d7a743a8f7ddad5f33a9829c81a0f04cdbfaef0"
        })
    );
    // same always-succeeding V3 script the fee tests use
    const plutusPolicy = new Script( ScriptType.PlutusV3, fromHex( "0101002499" ) );

    const txBuilder = new TxBuilder( defaultProtocolParameters, defaultMainnetGenesisInfos );

    const funds = new UTxO({
        utxoRef: { id: "aa".repeat( 32 ), index: 0 },
        resolved: { address: Address.fake, value: Value.lovelaces( 20_000_000 ) }
    });
    const collateral = new UTxO({
        utxoRef: { id: "bb".repeat( 32 ), index: 0 },
        resolved: { address: Address.fake, value: Value.lovelaces( 5_000_000 ) }
    });

    const mintEntry = ( policy: Script ) => ({
        value: {
            policy: new Hash28( policy.hash.toBuffer() ),
            assets: [ { name: fromAscii( "tok" ), quantity: 1 } ]
        },
        script: { inline: policy, redeemer: new DataI( 0 ) }
    });

    test("native policy alone: no redeemers", () => {
        const tx = txBuilder.buildSync({
            inputs: [ { utxo: funds } ],
            mints: [ mintEntry( nativePolicy ) ],
            changeAddress: Address.fake
        });
        expect( tx.witnesses.redeemers ?? [] ).toHaveLength( 0 );
        expect( tx.body.mint ).toBeDefined();
    });

    test("native + Plutus policy: one redeemer, at the Plutus policy's position", () => {
        const tx = txBuilder.buildSync({
            inputs: [ { utxo: funds } ],
            collaterals: [ collateral ],
            mints: [ mintEntry( nativePolicy ), mintEntry( plutusPolicy ) ],
            changeAddress: Address.fake
        });
        const rdmrs = tx.witnesses.redeemers ?? [];
        expect( rdmrs ).toHaveLength( 1 );
        expect( rdmrs[0].tag ).toBe( TxRedeemerTag.Mint );
        // the mint map is sorted by policy id; index 0 is the first non-ADA entry
        const policies = tx.body.mint!.map.slice( 1 ).map( e => e.policy.toString() );
        expect( policies[ rdmrs[0].index ] ).toBe( plutusPolicy.hash.toString() );
    });
});
