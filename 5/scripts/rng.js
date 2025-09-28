let seed = 0x12345;
export function srand(s){ seed = s >>> 0; }
export function rand(){ // xorshift32
let x = seed;
x ^= x << 13; x ^= x >>> 17; x ^= x << 5; seed = x >>> 0; return seed / 0xffffffff;
}