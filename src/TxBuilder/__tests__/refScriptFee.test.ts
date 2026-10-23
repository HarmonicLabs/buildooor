import { tieredRefScriptFee, REF_SCRIPT_TIER_BYTES } from "../utils/refScriptFee";

// mainnet / preprod value of minfeeRefScriptCostPerByte since Conway: 15 lovelace per byte
const rate = { num: BigInt( 15 ), den: BigInt( 1 ) };

describe("tieredRefScriptFee (Conway tierRefScriptFee)", () => {

    test("no reference scripts, no fee", () => {
        expect( tieredRefScriptFee( BigInt( 0 ), rate ) ).toBe( BigInt( 0 ) );
    });

    test("inside the first tier the flat rate applies", () => {
        expect( tieredRefScriptFee( BigInt( 1 ), rate ) ).toBe( BigInt( 15 ) );
        expect( tieredRefScriptFee( BigInt( 10_000 ), rate ) ).toBe( BigInt( 150_000 ) );
        expect( tieredRefScriptFee( REF_SCRIPT_TIER_BYTES, rate ) ).toBe( BigInt( 384_000 ) );
    });

    test("every further tier costs 1.2x the previous one", () => {
        // 25,600 * 15 + 1 * 18
        expect( tieredRefScriptFee( BigInt( 25_601 ), rate ) ).toBe( BigInt( 384_018 ) );
        // 25,600 * 15 + 25,600 * 18 + 8,800 * 21.6
        expect( tieredRefScriptFee( BigInt( 60_000 ), rate ) ).toBe( BigInt( 1_034_880 ) );
    });

    test("fractions are summed exactly and rounded down once, like the ledger", () => {
        // 25,600 * 15 + 25,600 * 18 + 25,600 * 21.6 + 1 * 25.92 = 1,397,785.92
        expect( tieredRefScriptFee( BigInt( 76_801 ), rate ) ).toBe( BigInt( 1_397_785 ) );
        // non-integer base rate: 44 / 3 per byte, 25,601 bytes = 375,466.66.. + 17.6 = 375,484.26..
        expect( tieredRefScriptFee( BigInt( 25_601 ), { num: BigInt( 44 ), den: BigInt( 3 ) } ) ).toBe( BigInt( 375_484 ) );
    });
});
