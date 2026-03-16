import { Tx, TxRedeemer } from "@harmoniclabs/cardano-ledger-ts"
import { Data } from "@harmoniclabs/plutus-data"
import { ExBudget, CEKValueObj } from "@harmoniclabs/plutus-machine"


export interface ITxBuildSyncOptions {
    /**
     * @default 1
     * @max 3
    **/
    nScriptExecitionRounds?: number
    onScriptInvalid?: ( rdmr: TxRedeemer, logs: string[], callArgs: Data[], tx: Tx ) => void
    onScriptResult?:  ( rdmr: TxRedeemer, result: CEKValueObj, exBudget: ExBudget, logs: string[], callArgs: Data[], scriptHash: string, tx: Tx ) => void
}

export interface ITxBuildOptions extends ITxBuildSyncOptions {
    keepWorkersAlive?: boolean
}