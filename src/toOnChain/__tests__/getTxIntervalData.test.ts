import { DataConstr, DataI } from "@harmoniclabs/plutus-data";
import { defaultPreprodGenesisInfos } from "../../TxBuilder/GenesisInfos";
import { getTxIntervalData } from "../getTxIntervalData";

// Plutus Bool: False = Constr 0 [], True = Constr 1 []
const TRUE = new DataConstr( 1, [] );
const FALSE = new DataConstr( 0, [] );
const NEG_INF = new DataConstr( 0, [] );
const POS_INF = new DataConstr( 2, [] );
const finite = ( ms: number ) => new DataConstr( 1, [ new DataI( ms ) ] );

const gi = defaultPreprodGenesisInfos;
const slot = BigInt( 100_000_000 );
const later = BigInt( 100_000_060 );
const ms = ( s: bigint ) => Number( gi.systemStartPosixMs ) + ( Number( s ) - Number( gi.startSlotNo ) ) * Number( gi.slotLengthMs );

const interval = ( from: DataConstr, fromIncl: DataConstr, to: DataConstr, toIncl: DataConstr ) =>
    new DataConstr( 0, [
        new DataConstr( 0, [ from, fromIncl ] ),
        new DataConstr( 0, [ to, toIncl ] )
    ]);

describe("getTxIntervalData: bounds as the ledger passes them", () => {

    test("no bounds: (-inf, +inf), both inclusive", () => {
        expect( getTxIntervalData( undefined, undefined, gi ).toJson() )
        .toEqual( interval( NEG_INF, TRUE, POS_INF, TRUE ).toJson() );
    });

    test("finite lower bound is inclusive", () => {
        expect( getTxIntervalData( slot, undefined, gi ).toJson() )
        .toEqual( interval( finite( ms( slot ) ), TRUE, POS_INF, TRUE ).toJson() );
    });

    test("finite upper bound is exclusive (Conway, protocol 9+)", () => {
        expect( getTxIntervalData( slot, later, gi ).toJson() )
        .toEqual( interval( finite( ms( slot ) ), TRUE, finite( ms( later ) ), FALSE ).toJson() );
    });

    test("upperBoundClosed: finite upper bound inclusive (before protocol 9)", () => {
        expect( getTxIntervalData( undefined, later, gi, true ).toJson() )
        .toEqual( interval( NEG_INF, TRUE, finite( ms( later ) ), TRUE ).toJson() );
    });
});
