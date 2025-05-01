import { Certificate, Credential, CertPoolRetirement, CertRegistrationDeposit, CertStakeDelegation, CertStakeDeRegistration, CertStakeRegistration, CertStakeRegistrationDeleg, CertStakeVoteDeleg, CertStakeVoteRegistrationDeleg, CertUnRegistrationDeposit, CertVoteDeleg, CertVoteRegistrationDeleg, CredentialType, Hash28, Script, Tx, CertAuthCommitteeHot, CertRegistrationDrep, CertUnRegistrationDrep, CertUpdateDrep, ScriptType } from "@harmoniclabs/cardano-ledger-ts";
import { Data, isData } from "@harmoniclabs/plutus-data";
import { lexCompare, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";

function getScriptByHash( tx: Tx, hash: Uint8Array | undefined ): Script<ScriptType> | undefined
{
    if(!(
        hash instanceof Uint8Array
        && hash.length === 28
    )) return undefined;
    const witnesses = tx.witnesses;
    return (
        witnesses.plutusV1Scripts?.find( s => uint8ArrayEq( hash, s.hash.toBuffer() ) )
        ?? witnesses.plutusV2Scripts?.find( s => uint8ArrayEq( hash, s.hash.toBuffer() ) )
        ?? witnesses.plutusV3Scripts?.find( s => uint8ArrayEq( hash, s.hash.toBuffer() ) )
        ?? tx.body.refInputs?.find(
            i => i.resolved.refScript && uint8ArrayEq( hash, i.resolved.refScript.hash.toBuffer() )
        )?.resolved.refScript
    ) as Script<ScriptType> | undefined;
}

export function getSpendingScript( tx: Tx, index: number ): { script: Script, datum: Data | undefined } | undefined
{
    if( tx.body.inputs.length <= index ) return undefined;

    const sortedIns = tx.body.inputs.slice().sort((a,b) => {
        const ord = lexCompare( a.utxoRef.id.toBuffer(), b.utxoRef.id.toBuffer() );
        // if equal tx id order based on tx output index
        if( ord === 0 ) return a.utxoRef.index - b.utxoRef.index;
        // else order by tx id
        return ord;
        
    });
    const scriptInput = sortedIns[index];
    if( !scriptInput ) return undefined;
    
    const scriptHash = scriptInput.resolved.address.paymentCreds.hash.toBuffer();

    const script = getScriptByHash( tx, scriptHash );
    if( !script ) return undefined;

    if( isData( scriptInput.resolved.datum ) ) return { script, datum: scriptInput.resolved.datum };
    
    return { script, datum: undefined };
}

export function getMintingScript( tx: Tx, index: number ): Script<ScriptType> | undefined
{
    const mintedValue = tx.body.mint;
    if( !mintedValue ) return undefined;

    const allPolicies = mintedValue.map.map( entry => entry.policy ).filter( p => p instanceof Hash28 ) as Hash28[];
    if( allPolicies.length === 0 ) return undefined;

    const policyHash = allPolicies[index-1];
    if( !policyHash ) return undefined;
    
    return getScriptByHash( tx, policyHash.toBuffer() );
}

export function getCeritficateScript( tx: Tx, index: number ): Script<ScriptType> | undefined
{
    const allCertificates = tx.body.certs;
    if( !allCertificates ) return undefined;

    const cert = allCertificates[index];
    if( !cert ) return undefined;

    return getScriptByHash( tx, getCertStakeCreds( cert )?.hash.toBuffer() );
}

export function getWithdrawalScript( tx: Tx, index: number ): Script<ScriptType> | undefined
{
    const allWithdrawals = tx.body.withdrawals;
    if( !allWithdrawals ) return undefined;

    const scriptHash = allWithdrawals.map[index]?.rewardAccount.credentials.toBuffer();
    if( !scriptHash ) return undefined;

    return getScriptByHash( tx, scriptHash );
}

export function getVotingScript( tx: Tx, index: number ): Script<ScriptType> | undefined
{
    // TODO
    return undefined;
}

export function getProposingScript( tx: Tx, index: number ): Script<ScriptType> | undefined
{
    // TODO
    return undefined;
}

function getCertStakeCreds( cert: Certificate ): Credential | undefined
{
    // CertAuthCommitteeHot | CertResignCommitteeCold | CertRegistrationDrep | CertUnRegistrationDrep | CertUpdateDrep;
    if(
        cert instanceof CertStakeRegistration
        || cert instanceof CertStakeDeRegistration
        || cert instanceof CertStakeDelegation
        || cert instanceof CertVoteDeleg
        || cert instanceof CertStakeVoteDeleg
        || cert instanceof CertRegistrationDeposit
        || cert instanceof CertUnRegistrationDeposit
        || cert instanceof CertStakeRegistrationDeleg
        || cert instanceof CertVoteRegistrationDeleg
        || cert instanceof CertStakeVoteRegistrationDeleg
    ) return cert.stakeCredential;
    if(
        cert instanceof CertRegistrationDrep
        || cert instanceof CertUnRegistrationDrep
        || cert instanceof CertUpdateDrep
    ) return cert.drepCredential;
    return undefined;
}