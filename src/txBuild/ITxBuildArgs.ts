import { Address, AddressStr, CanBeHash28, Hash32, IProposalProcedure, IUTxO, IVotingProcedures, IVotingProceduresEntry, PubKeyHash, Script, TxMetadata, TxOut, UTxO, VotingProcedures, isIProposalProcedure, isITxOut, isIUTxO, isIVotingProceduresEntry } from "@harmoniclabs/cardano-ledger-ts";
import { NormalizedITxBuildCert, type ITxBuildCert, normalizeITxBuildCert } from "./ITxBuildCert";
import { NormalizedITxBuildInput, type ITxBuildInput, normalizeITxBuildInput } from "./ITxBuildInput/ITxBuildInput";
import { NormalizedITxBuildMint, type ITxBuildMint, normalizeITxBuildMint } from "./ITxBuildMint";
import { txBuildOutToTxOut, type ITxBuildOutput } from "./ITxBuildOutput";
import { NormalizedITxBuildWithdrawal, type ITxBuildWithdrawal, normalizeITxBuildWithdrawal } from "./ITxBuildWithdrawal";
import { CanBeUInteger } from "../utils/ints";
import { ChangeInfos, NormalizedChangeInfos, normalizeChangeInfos } from "./ChangeInfos/ChangeInfos";
import { ITxBuildVotingProcedure, NormalizedITxBuildVotingProcedure, normalizeITxBuildVotingProcedure } from "./ITxBuildVotingProcedure";
import { ITxBuildProposalProcedure, NormalizedITxBuildProposalProcedure, normalizeITxBuildProposalProcedure } from "./ITxBuildProposalProcedure";

import { fromHex } from "@harmoniclabs/uint8array-utils";

export interface ITxBuildArgs {
  inputs: (ITxBuildInput | IUTxO )[];
  /**
   * same as `changeAddress` but allows to specify datums and ref scripts
   * @example
   * ```ts
   * txBuilder.build({
   *     change: { address: "your_address" }
   * });
   * ```
   */
  changeAddress?: Address | AddressStr,
  change?: ChangeInfos;
  outputs?: ITxBuildOutput[],
  readonlyRefInputs?: IUTxO[],
  requiredSigners?: CanBeHash28[], // PubKeyHash[],
  // readonlyRefInputs?: (IUTxO | string | Uint8Array)[];
  // requiredSigners?: (CanBeHash28 | string | Uint8Array)[]; // PubKeyHash[],
  collaterals?: IUTxO[],
  collateralReturn?: ITxBuildOutput,
  mints?: ITxBuildMint[],
  invalidBefore?: CanBeUInteger,
  invalidAfter?: CanBeUInteger,
  certificates?: ITxBuildCert[],
  withdrawals?: ITxBuildWithdrawal[],


  /**
   * # metadata message following cip20
   *
   * overwrites the metadata at label 674 if already present.
   **/
  memo?: string;
  metadata?: TxMetadata;
  // conway
  votingProcedures?: (IVotingProceduresEntry | ITxBuildVotingProcedure)[];
  proposalProcedures?: (IProposalProcedure | ITxBuildProposalProcedure)[];
  currentTreasuryValue?: CanBeUInteger;
  paymentToTreasury?: CanBeUInteger;
}

export interface NormalizedITxBuildArgs extends ITxBuildArgs {
  inputs: NormalizedITxBuildInput[];
  changeAddress?: Address ;
  change?: NormalizedChangeInfos;
  outputs?: TxOut[];
  // era?: Era // latest
  readonlyRefInputs?: UTxO[];
  requiredSigners?: PubKeyHash[];
  collaterals?: UTxO[];
  collateralReturn?: TxOut;
  mints?: NormalizedITxBuildMint[];
  invalidBefore?: CanBeUInteger;
  invalidAfter?: CanBeUInteger;
  certificates?: NormalizedITxBuildCert[];
  withdrawals?: NormalizedITxBuildWithdrawal[];
  /**
   * # metadata message following cip20
   *
   * overwrites the metadata at label 674 if already present.
   **/
  memo?: string;
  metadata?: TxMetadata;
  // conway
  votingProcedures?: NormalizedITxBuildVotingProcedure[];
  proposalProcedures?: NormalizedITxBuildProposalProcedure[];
  currentTreasuryValue?: CanBeUInteger;
  paymentToTreasury?: CanBeUInteger;
}

export function normalizeITxBuildArgs({
  inputs,
  change,
  changeAddress,
  outputs,
  readonlyRefInputs,
  requiredSigners,
  collaterals,
  collateralReturn,
  mints,
  invalidBefore,
  invalidAfter,
  certificates,
  withdrawals,
  memo,
  metadata,
  votingProcedures,
  proposalProcedures,
  currentTreasuryValue,
  paymentToTreasury,
}: ITxBuildArgs): NormalizedITxBuildArgs {
  return {
    inputs: inputs.map(normalizeITxBuildArgsInputs),
    change: change ? normalizeChangeInfos(change) : undefined,
    changeAddress: normalizeChangeAddress(changeAddress),
    outputs: outputs?.map(normalizeTxBuildArgsOutputs),
    readonlyRefInputs: readonlyRefInputs?.map(toUTxONoClone),
    requiredSigners: requiredSigners?.map(toPubKeyHash),
    collaterals: collaterals?.map(toUTxONoClone),
    collateralReturn: collateralReturn
      ? txBuildOutToTxOut(collateralReturn)
      : undefined,
    mints: mints?.map(normalizeITxBuildMint),
    invalidBefore:
      invalidBefore === undefined ? undefined : BigInt(invalidBefore),
    invalidAfter: invalidAfter === undefined ? undefined : BigInt(invalidAfter),
    certificates: certificates?.map(normalizeITxBuildCert),
    withdrawals: withdrawals?.map(normalizeITxBuildWithdrawal),
    memo: memo ? String(memo) : undefined,
    metadata,
    votingProcedures: Array.isArray(votingProcedures)
      ? votingProcedures.map((entry) => {
          if (isIVotingProceduresEntry(entry))
            entry = {
              votingProcedure: entry,
              script: undefined, // for js shape optimization
            };
          return normalizeITxBuildVotingProcedure(entry);
        })
      : undefined,
    proposalProcedures: Array.isArray(proposalProcedures)
      ? proposalProcedures.map((entry) => {
          if (isIProposalProcedure(entry))
            entry = {
              proposalProcedure: entry,
              script: undefined,
            };
          return normalizeITxBuildProposalProcedure(entry);
        })
      : undefined,
    currentTreasuryValue:
      currentTreasuryValue === undefined
        ? undefined
        : BigInt(currentTreasuryValue),
    paymentToTreasury:
      paymentToTreasury === undefined ? undefined : BigInt(paymentToTreasury),
  };
}


//Check input type and convert to NormalizedITxBuildInput
function normalizeITxBuildArgsInputs(input: ITxBuildInput | IUTxO  ): NormalizedITxBuildInput {
  if (typeof input === "string") {
    try {
      const cborData = fromHex(input);
      const iUtxo = UTxO.fromCbor(cborData);
      if (!isIUTxO(iUtxo)) throw new Error("Invalid UTxO structure");
      return normalizeITxBuildInput({ utxo: new UTxO(iUtxo) });
    } catch (error) {
      throw new Error("Error processing CBOR data: " + (error as Error).message);
    }
  } else if (input instanceof Uint8Array) {
    try {
      const iUtxo = UTxO.fromCbor(input);
      if (!isIUTxO(iUtxo)) throw new Error("Invalid UTxO structure");
      return normalizeITxBuildInput({ utxo: new UTxO(iUtxo) });
    } catch (error) {
      throw new Error("Error processing CBOR data: " + (error as Error).message);
    }
  } else if (isIUTxO(input)) {
    return { utxo: new UTxO(input) };
  } else {
    return normalizeITxBuildInput(input);
  }
}
function normalizeChangeAddress(changeAddress: Address | AddressStr | undefined): Address | undefined {
  if (changeAddress === undefined) {
    return undefined;
  }
  if (changeAddress instanceof Address) {
    return changeAddress; // Already an Address, no conversion needed
  } else if (typeof changeAddress === "string") {
    try {
      return Address.fromString(changeAddress);
    } catch (error) {
      throw new Error("Error converting string to Address: " + (error as Error).message);
    }
  } else {
    throw new Error("Invalid changeAddress type. Expected Address or string.");
  }
}
function normalizeTxBuildArgsOutputs (output: TxOut ): TxOut {
  if (typeof output === "string") {
    try {
      const cborData = fromHex(output);
      // console.log(" outputs cborData", cborData);
      const txOut = txBuildOutToTxOut( TxOut.fromCbor(cborData)) ;
      console.log("is txOut: ", isITxOut(txOut));
      if (!isITxOut(txOut)) throw new Error("Invalid TxOut structure");
      return txOut;
    } catch (error) {
      throw new Error("Error processing CBORstring data: " + (error as Error).message);
    }
  }else if (output instanceof Uint8Array) {
    try {
      const txOut = txBuildOutToTxOut(TxOut.fromCbor(output));
      if (!isITxOut(txOut)) throw new Error("Invalid TxOut structure");
      return txOut;
    } catch (error) {
      throw new Error("Error processing CBOR data: " + (error as Error).message);
    }
  }
  return txBuildOutToTxOut(output);
}

function toUTxONoClone(utxo: IUTxO): UTxO {

  return utxo instanceof UTxO ? utxo : new UTxO(utxo);
}

function toPubKeyHash(hash: CanBeHash28): PubKeyHash {
  return new PubKeyHash(hash);
}

/** @deprecated use `normalizeITxBuildArgs` instead */
export function cloneITxBuildArgs(args: ITxBuildArgs): ITxBuildArgs {
  return normalizeITxBuildArgs(args);
}
