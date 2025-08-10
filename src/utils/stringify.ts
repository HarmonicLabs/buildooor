import { isObject } from "@harmoniclabs/obj-utils";
import { toHex } from "@harmoniclabs/uint8array-utils";

export function mkReplacer(
    replacer?: (key: string, value: any) => any | null,
    seen: WeakSet<any> = new WeakSet()
)
{
    if( typeof replacer !== "function" ) replacer = ( k, v ) => v;
    return function( key: string, value: any )
    {
        value = replacer!(key, value);
        if( isObject( value ) )
        {
            if ( seen.has(value) ) {
                return undefined
            }
            seen.add(value);

            if( typeof value.buffer === "object" && value.buffer instanceof ArrayBuffer )
            {
                value = new Uint8Array(value.buffer);
            }
            if( value instanceof Uint8Array)
            {
                value = toHex(value);
            }
        }
        if( typeof value === "bigint" )
        {
            value = value.toString();
        }

        return value;
    };
}

export function stringify(
    value: any,
    replacer?: (key: string, value: any) => any | null | (number | string)[],
    space: string | number = 0
): string 
{
    return JSON.stringify(value, mkReplacer( replacer, new WeakSet() ), space);
}