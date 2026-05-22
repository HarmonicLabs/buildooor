import {
    Address, Credential, Hash28, UTxO, Value,
    defaultProtocolParameters,
    certificateFromCertificateLike,
    CertificateType
} from "@harmoniclabs/cardano-ledger-ts";
import { TxBuilder, defaultMainnetGenesisInfos } from "..";

describe("cert deposit balancing", () => {

    const addr0 = Address.fromString(
        "addr_test1qzq55vqf303tduqa0f6r4rmamt2lxw5c98yp5rcyekl6aupgrkxchwfa7uzxtc4sssn4hdp8pdhpe0gvnl3tec8yzjsq5enqa4"
    );
    const stakeCredential = Credential.keyHash(
        new Hash28( "00".repeat( 28 ) )
    );

    const ownerPkh = addr0.paymentCreds.hash.toBuffer();

    const utxoFor = ( lovelace: number ): UTxO => new UTxO({
        utxoRef: { id: "ab".repeat( 32 ), index: 0 },
        resolved: { address: addr0, value: Value.lovelaces( lovelace ) }
    });

    test( "registration cert deducts deposit from change", () => {
        const txBuilder = new TxBuilder(
            defaultProtocolParameters,
            defaultMainnetGenesisInfos
        );
        // Input must comfortably exceed deposit + fee + min-utxo on change.
        // With defaultProtocolParameters.utxoCostPerByte = 34482, an ada-only
        // change output's min-utxo is ~7.83M lovelace, so 10M − 2M deposit
        // sits right at the edge. 15M leaves clear headroom.
        const inputLovelaces = 15_000_000;
        const deposit = 2_000_000n;

        const tx = txBuilder.buildSync({
            inputs: [{ utxo: utxoFor( inputLovelaces ) }],
            certificates: [{
                cert: certificateFromCertificateLike({
                    certType: CertificateType.RegistrationDeposit,
                    stakeCredential,
                    deposit
                })
            }],
            changeAddress: addr0,
            requiredSigners: [ ownerPkh ]
        });

        expect( tx.body.outputs ).toHaveLength( 1 ); // only the change output
        const change = tx.body.outputs[ 0 ];
        const fee = tx.body.fee;
        // change == inputs - fee - deposit
        expect( change.value.lovelaces ).toBe(
            BigInt( inputLovelaces ) - fee - deposit
        );
    });

    test( "de-registration cert credits refund into change", () => {
        const txBuilder = new TxBuilder(
            defaultProtocolParameters,
            defaultMainnetGenesisInfos
        );
        const inputLovelaces = 10_000_000;
        const refund = 2_000_000n;

        const tx = txBuilder.buildSync({
            inputs: [{ utxo: utxoFor( inputLovelaces ) }],
            certificates: [{
                cert: certificateFromCertificateLike({
                    certType: CertificateType.UnRegistrationDeposit,
                    stakeCredential,
                    deposit: refund
                })
            }],
            changeAddress: addr0,
            requiredSigners: [ ownerPkh ]
        });

        expect( tx.body.outputs ).toHaveLength( 1 );
        const change = tx.body.outputs[ 0 ];
        const fee = tx.body.fee;
        // change == inputs + refund - fee
        expect( change.value.lovelaces ).toBe(
            BigInt( inputLovelaces ) + refund - fee
        );
    });

    test( "throws when stakeAddressDeposit is missing for legacy CertStakeRegistration", () => {
        // Build a TxBuilder whose params explicitly omit stakeAddressDeposit.
        // We strip the field from defaultProtocolParameters so completion preserves
        // the absence; defaultTxBuilderProtocolParameters has it as `undefined`.
        const ppNoDeposit = { ...defaultProtocolParameters };
        delete ( ppNoDeposit as any ).stakeAddressDeposit;
        const txBuilder = new TxBuilder( ppNoDeposit, defaultMainnetGenesisInfos );

        expect( () => txBuilder.buildSync({
            inputs: [{ utxo: utxoFor( 10_000_000 ) }],
            certificates: [{
                cert: certificateFromCertificateLike({
                    certType: CertificateType.StakeRegistration,
                    stakeCredential
                })
            }],
            changeAddress: addr0,
            requiredSigners: [ ownerPkh ]
        }) ).toThrow( /stakeAddressDeposit/ );
    });
});
