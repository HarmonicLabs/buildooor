import { ValueUnits, Value, UTxO } from "@harmoniclabs/cardano-ledger-ts";
import { ITxBuildInput, cloneITxBuildInput } from "../txBuild";
import { CanBeUInteger, forceBigUInt } from "../utils/ints";

type UnitQuantities = { [unit: string]: bigint };

export function keepRelevant(
    requestedOutputSet: ValueUnits | Value,
    initialUTxOSet: ITxBuildInput[],
    minimumLovelaceRequired: CanBeUInteger = 5_000_000,
): ITxBuildInput[] {
    const requested = normalizeRequestedOutputSet(requestedOutputSet);

    const requestedLovelace =
        (requested["lovelace"] ?? BigInt(0)) + forceBigUInt(minimumLovelaceRequired);

    const requestedAssetUnits = Object.keys(requested)
        .filter((unit) => unit !== "lovelace");

    const multiAssetIns = initialUTxOSet.filter((input) =>
        new UTxO(input.utxo).resolved.value.toUnits()
            .filter((asset) => asset.unit !== "lovelace")
            .some((asset) => requestedAssetUnits.includes(asset.unit))
    );

    const totLovelaces = getTotLovelaces(multiAssetIns);

    const lovelaceIns = totLovelaces < requestedLovelace ?
        remainingLovelace(
            requestedLovelace - totLovelaces,
            // filter out initial utxos already included trough multi asset selection
            initialUTxOSet.filter((initialUtxo) => {

                const refStr = utxoRefStr(initialUtxo);

                return !multiAssetIns.some((selectedUtxo) =>
                    utxoRefStr(selectedUtxo) === refStr
                );
            })
        )
        : [];

    return lovelaceIns.concat(multiAssetIns)
        .map(cloneITxBuildInput);
}

/**
 * `keepRelevant` historically accepted (and documented) two different shapes:
 * the `ValueUnits` array returned by `Value.toUnits()` and a Mesh-style
 * `{ [unit]: quantity }` record. Normalize both to a record with `bigint`
 * quantities so the rest of the algorithm only deals with one shape.
 */
function normalizeRequestedOutputSet(requested: ValueUnits | Value): UnitQuantities {
    if (
        requested instanceof Value ||
        // tolerate `Value` instances from a duplicated `cardano-ledger-ts`
        // in node_modules, where `instanceof` fails across the two copies
        (!Array.isArray(requested) && typeof (requested as any)?.toUnits === "function")
    ) {
        requested = (requested as Value).toUnits();
    }

    const result: UnitQuantities = {};

    if (Array.isArray(requested)) {
        for (const { unit, quantity } of requested) {
            result[unit] = (result[unit] ?? BigInt(0)) + BigInt(quantity);
        }
        return result;
    }

    for (const unit of Object.keys(requested as object)) {
        result[unit] = BigInt((requested as any)[unit]);
    }
    return result;
}

function utxoRefStr(input: ITxBuildInput): string {
    const ref = input.utxo.utxoRef;
    return ref.id.toString() + "#" + ref.index.toString();
}

function getTotLovelaces(multiAsset: ITxBuildInput[]): bigint {
    return multiAsset.reduce(
        (sum, input) => sum + new UTxO(input.utxo).resolved.value.lovelaces,
        BigInt(0)
    );
};

function remainingLovelace(quantity: bigint, initialUTxOSet: ITxBuildInput[]): ITxBuildInput[] {
    const sortedUTxOs = initialUTxOSet.slice().sort(
        (a, b) => {
            const aLovelaces = new UTxO(a.utxo).resolved.value.lovelaces;
            const bLovelaces = new UTxO(b.utxo).resolved.value.lovelaces;
            return aLovelaces < bLovelaces ? -1 : aLovelaces > bLovelaces ? 1 : 0;
        }
    );

    const requestedOutputSet: UnitQuantities = {
        lovelace: quantity
    };

    const selection = selectValue(
        sortedUTxOs, requestedOutputSet,
    );

    return selection;
}

function enoughValueHasBeenSelected(
    selection: ITxBuildInput[], assets: UnitQuantities,
): boolean {
    return Object.keys(assets)
        .every((unit) => {

            return selection
                .reduce(
                    (selectedQuantity, input) => {
                        const utxoQuantity = new UTxO(input.utxo).resolved.value.toUnits()
                            .reduce(
                                (quantity, a) => quantity + (unit === a.unit ? BigInt(a.quantity) : BigInt(0)),
                                BigInt(0),
                            );

                        return selectedQuantity + utxoQuantity;
                    },
                    BigInt(0)
                ) >= assets[unit];
        });
}

function selectValue(
    inputUTxO: ITxBuildInput[],
    outputSet: UnitQuantities,
    selection: ITxBuildInput[] = []
): ITxBuildInput[] {
    if (
        inputUTxO.length === 0 ||
        enoughValueHasBeenSelected(selection, outputSet)
    ) {
        return selection;
    }

    if (canValueBeSelected(inputUTxO[0], outputSet)) {
        return selectValue(
            inputUTxO.slice(1), outputSet,
            selection.concat(inputUTxO[0])
        );
    }

    return selectValue(
        inputUTxO.slice(1),
        outputSet, selection,
    );
}

function canValueBeSelected(
    input: ITxBuildInput,
    assets: UnitQuantities
): boolean {
    return Object.keys(assets).some((unit) => {
        return new UTxO(input.utxo).resolved.value.toUnits()
            .some((asset) => asset.unit === unit);
    });
}