import { defaultProtocolParameters, Address, Credential, PubKeyHash, Script, ScriptType, UTxO, Value, getNSignersNeeded, CredentialType, PublicKey, PrivateKey } from "@harmoniclabs/cardano-ledger-ts";
import { Cbor, CborBytes } from "@harmoniclabs/cbor";
import { DataConstr } from "@harmoniclabs/plutus-data";
import { TxBuilder } from "../TxBuilder"
import { fromHex } from "@harmoniclabs/uint8array-utils";

const txBuilder = new TxBuilder(
    defaultProtocolParameters
)

const sk = new PrivateKey( "1b372f69".repeat(8) ); // 4 * 8 = 32 bytes
const pk = sk.derivePublicKey();
const someHash = fromHex( "1b372f42".repeat(8) ); // 4 * 8 = 32 bytes

const pkAddr = Address.testnet(
    Credential.keyHash(
        pk.hash
    )
);

test("smallest possible tx", () => {
    
    const tx = txBuilder.buildSync({
        inputs: [
            new UTxO({
                utxoRef: {
                    id: "ff".repeat(32),
                    index: 0
                },
                resolved: {
                    address: pkAddr,
                    value: Value.lovelaces( 1889618 )
                }
            })
        ],
        changeAddress: pkAddr
    });

    tx.signWith( sk );

    // console.log( (1889618).toString(16).length/2 );
    // console.log( tx.toCbor().length );
    // console.log( JSON.stringify( tx, null, 2 ) );
});

test.todo("depends on onchain");
/*
const succeedScript = new Script(
    ScriptType.PlutusV2,
    Cbor.encode(
        new CborBytes(
            Cbor.encode(
                new CborBytes(

                    compile(
                        pfn([
                            data,
                            data,
                            V2.PScriptContext.type
                        ],  unit)
                        (( dat, rdmr, ctx) => pmakeUnit() )
                    )
                    
                )
            ).toBuffer()
        )
    ).toBuffer()
);

const succeedScriptAddr = new Address(
    "testnet",
    new Credential(
        "script",
        succeedScript.hash
    )
) 

describe("TxBuilder.buildSync", () => {

    test("simple pub key input", () => {

        const tx = txBuilder.buildSync({
            inputs: [
                {
                    utxo: new UTxO({
                        utxoRef: {
                            id: "ff".repeat(32),
                            index: 0
                        },
                        resolved: {
                            address: pkAddr,
                            value: Value.lovelaces( 10_000_000 )
                        }
                    })
                }
            ],
            changeAddress: pkAddr
        });

        expect( getNSignersNeeded( tx.body ) ).toEqual( 1 );
        
    });

    describe("simple spend script", () => {

        test("fails on missing script", () => {

            expect(
                () => txBuilder.buildSync({
                    inputs: [
                        {
                            utxo: new UTxO({
                                utxoRef: {
                                    id: "ff".repeat(32),
                                    index: 0
                                },
                                resolved: {
                                    address: succeedScriptAddr,
                                    value: Value.lovelaces( 10_000_000 )
                                }
                            })
                        }
                    ],
                    changeAddress: pkAddr
                })
            ).toThrow()
    
        });

        test("script included in transaction", () => {

            const tx = txBuilder.buildSync({
                inputs: [
                    {
                        utxo: new UTxO({
                            utxoRef: {
                                id: "ff".repeat(32),
                                index: 0
                            },
                            resolved: {
                                address: succeedScriptAddr,
                                value: Value.lovelaces( 10_000_000 ),
                                datum: new DataConstr( 0, [] )
                            }
                        }),
                        inputScript: {
                            datum: "inline",
                            redeemer: new DataConstr( 0, [] ),
                            script: succeedScript
                        }
                    }
                ],
                changeAddress: pkAddr
            });

        });

        test("script included in transaction as reference script", () => {

            const tx = txBuilder.buildSync({
                inputs: [
                    {
                        utxo: new UTxO({
                            utxoRef: {
                                id: "ff".repeat(32),
                                index: 0
                            },
                            resolved: {
                                address: succeedScriptAddr,
                                value: Value.lovelaces( 10_000_000 ),
                                datum: new DataConstr( 0, [] )
                            }
                        }),
                        referenceScript: {
                            datum: "inline",
                            redeemer: new DataConstr( 0, [] ),
                            refUtxo: new UTxO({
                                utxoRef: {
                                    id: "ff".repeat(32),
                                    index: 0
                                },
                                resolved: {
                                    address: succeedScriptAddr,
                                    value: Value.lovelaces( 10_000_000 ),
                                    refScript: succeedScript
                                }
                            })
                        }
                    }
                ],
                changeAddress: pkAddr
            });

        });

        test("inline datum specified but none present", () => {

            // script in transaciton
            expect( () => 
                txBuilder.buildSync({
                    inputs: [
                        {
                            utxo: new UTxO({
                                utxoRef: {
                                    id: "ff".repeat(32),
                                    index: 0
                                },
                                resolved: {
                                    address: succeedScriptAddr,
                                    value: Value.lovelaces( 10_000_000 ),
                                    // datum: new DataConstr( 0, [] )
                                }
                            }),
                            inputScript: {
                                script: succeedScript,
                                datum: "inline",
                                redeemer: new DataConstr( 0, [] )
                            }
                        }
                    ],
                    changeAddress: pkAddr
                })
            ).toThrow()

            // reference script
            expect( () => 
                txBuilder.buildSync({
                    inputs: [
                        {
                            utxo: new UTxO({
                                utxoRef: {
                                    id: "ff".repeat(32),
                                    index: 0
                                },
                                resolved: {
                                    address: succeedScriptAddr,
                                    value: Value.lovelaces( 10_000_000 ),
                                    // datum: new DataConstr( 0, [] )
                                }
                            }),
                            referenceScript: {
                                datum: "inline",
                                redeemer: new DataConstr( 0, [] ),
                                refUtxo: new UTxO({
                                    utxoRef: {
                                        id: "ff".repeat(32),
                                        index: 0
                                    },
                                    resolved: {
                                        address: pkAddr,                // doesn't matter
                                        value: Value.lovelaces( 0 ),   // doesn't matter
                                        refScript: succeedScript
                                    }
                                })
                            }
                        }
                    ],
                    changeAddress: pkAddr
                })
            ).toThrow()

        });

    })
})

*/