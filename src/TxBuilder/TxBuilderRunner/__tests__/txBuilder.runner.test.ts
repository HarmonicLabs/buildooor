import { Address, Script, Credential, Hash32, UTxO, Value, defaultProtocolParameters, isIUTxO } from "@harmoniclabs/cardano-ledger-ts";
import { ITxRunnerProvider } from "../../IProvider";
import { TxBuilder } from "../../TxBuilder";
import { DataConstr, DataI } from "@harmoniclabs/plutus-data";

const SYS_START = 1506203091000; // Date.parse("2017-09-23T21:44:51Z"); // mainnet start

const fakeProvider: ITxRunnerProvider = {
    async getGenesisInfos()
    {
        return {
            slotLengthInMilliseconds: 1000,
            systemStartPOSIX: SYS_START
        }
    },
    async resolveUtxos(utxos)
    {
        return utxos.map( u => {

            if( u instanceof UTxO ) return u;
            if( isIUTxO( u ) ) return new UTxO( u );

            if( typeof u === "string" )
            {
                const [ id, idx ] = u.split("#");
                u = {
                    id: id,
                    index: parseInt( idx )
                };
            }

            return new UTxO({
                utxoRef: u,
                resolved: {
                    address: Address.fake,
                    value: Value.lovelaces( 10_000_000 )
                }
            });
        })
    },
    async resolveDatumHashes( hashes: Hash32[] ) { return [ { hash: "00".repeat(32), datum: new DataConstr( 0, [] )} ] },
    async getChangeAddress() {
        return Address.testnet(
            Credential.keyHash( "aa".repeat(28) )
        );
    }
}

const txBuilder = new TxBuilder( defaultProtocolParameters );

const txRunner = txBuilder.runWithProvider( fakeProvider );

describe("TxBuilderRunner", () => {

    test("simple", async () => {

        const tx = await txRunner
        .addInputs([
            new UTxO({
                utxoRef: {
                    id: "00".repeat( 32 ),
                    index: 0
                },
                resolved: {
                    address: Address.fake,
                    value: Value.lovelaces( 10_000_000 )
                }
            })
        ])
        .payTo( Address.fake, 5_000_000 )
        .build();

    });

    test("attachMemo adds a CIP-20 message under label 674", async () => {

        const runner = txBuilder.runWithProvider( fakeProvider );
        expect( typeof runner.attachMemo ).toBe( "function" );

        const tx = await runner
        .addInputs([ `${"00".repeat( 32 )}#0` ])
        .payTo( Address.fake, 5_000_000 )
        .attachMemo( "hello" )
        .build();

        const meta = tx.auxiliaryData?.metadata?.metadata as any;
        expect( meta ).toBeDefined();
        const msg = meta[ "674" ];
        expect( msg.map[0].k.text ).toBe( "msg" );
        expect( msg.map[0].v.list.map( ( t: any ) => t.text ) ).toEqual([ "hello" ]);
    });

    test("simple but unresolved", async () => {

        const tx = await txRunner
        .addInputs([ `${"00".repeat( 32 )}#0` ])
        .payTo( Address.fake, 5_000_000 )
        .build();
        
    });

})