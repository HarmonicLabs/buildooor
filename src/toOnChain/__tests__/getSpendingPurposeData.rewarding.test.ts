import { Address, StakeAddress, StakeValidatorHash, TxBody, TxOut, TxRedeemer, TxRedeemerTag, TxWithdrawals, UTxO, Value } from "@harmoniclabs/cardano-ledger-ts";
import { DataI } from "@harmoniclabs/plutus-data";
import { ExBudget } from "@harmoniclabs/plutus-machine";
import { getSpendingPurposeData } from "../getSpendingPurposeData";

// V1/V2: Rewarding StakingCredential, where StakingCredential = StakingHash Credential (Constr 0).
// V3:    Rewarding Credential.
describe("Rewarding script purpose per Plutus version", () => {

    const hash = "cc".repeat( 28 );
    const body = new TxBody({
        inputs: [ new UTxO({
            utxoRef: { id: "00".repeat( 32 ), index: 0 },
            resolved: { address: Address.fake, value: Value.lovelaces( 5_000_000 ) }
        }) ],
        outputs: [ new TxOut({ address: Address.fake, value: Value.lovelaces( 4_800_000 ) }) ],
        fee: 200_000,
        withdrawals: new TxWithdrawals([{
            rewardAccount: new StakeAddress({ network: "testnet", credentials: new StakeValidatorHash( hash ), type: "script" }),
            amount: 0
        }])
    });
    const rdmr = new TxRedeemer({
        tag: TxRedeemerTag.Withdraw,
        index: 0,
        data: new DataI( 0 ),
        execUnits: new ExBudget({ mem: 0, cpu: 0 })
    });
    const cred = { constr: 1, fields: [ { bytes: hash } ] };

    test("v1 and v2 wrap the credential in StakingHash", () => {
        for( const v of [ "v1", "v2" ] as const )
        expect( getSpendingPurposeData( rdmr, body, v ).toJson() )
        .toEqual({ constr: 2, fields: [ { constr: 0, fields: [ cred ] } ] });
    });

    test("v3 takes the credential itself", () => {
        expect( getSpendingPurposeData( rdmr, body, "v3" ).toJson() )
        .toEqual({ constr: 2, fields: [ cred ] });
    });
});
