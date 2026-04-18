import type { DefaultFunction } from "$lib/plutus";

export type BuiltinCategory =
  | "Integer"
  | "ByteString"
  | "Crypto"
  | "String"
  | "Control"
  | "Pair"
  | "List"
  | "Array"
  | "Data"
  | "BLS12-381"
  | "Value";

export interface BuiltinMeta {
  category: BuiltinCategory;
  /** Plutus-style, name-less: e.g. "integer -> integer -> integer". */
  signature: string;
}

export const BUILTIN_META: Record<DefaultFunction, BuiltinMeta> = {
  // Integer (11)
  addInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  subtractInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  multiplyInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  divideInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  quotientInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  remainderInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  modInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer",
  },
  equalsInteger: {
    category: "Integer",
    signature: "integer -> integer -> bool",
  },
  lessThanInteger: {
    category: "Integer",
    signature: "integer -> integer -> bool",
  },
  lessThanEqualsInteger: {
    category: "Integer",
    signature: "integer -> integer -> bool",
  },
  expModInteger: {
    category: "Integer",
    signature: "integer -> integer -> integer -> integer",
  },

  // ByteString (21)
  appendByteString: {
    category: "ByteString",
    signature: "bytestring -> bytestring -> bytestring",
  },
  consByteString: {
    category: "ByteString",
    signature: "integer -> bytestring -> bytestring",
  },
  sliceByteString: {
    category: "ByteString",
    signature: "integer -> integer -> bytestring -> bytestring",
  },
  lengthOfByteString: {
    category: "ByteString",
    signature: "bytestring -> integer",
  },
  indexByteString: {
    category: "ByteString",
    signature: "bytestring -> integer -> integer",
  },
  equalsByteString: {
    category: "ByteString",
    signature: "bytestring -> bytestring -> bool",
  },
  lessThanByteString: {
    category: "ByteString",
    signature: "bytestring -> bytestring -> bool",
  },
  lessThanEqualsByteString: {
    category: "ByteString",
    signature: "bytestring -> bytestring -> bool",
  },
  andByteString: {
    category: "ByteString",
    signature: "bool -> bytestring -> bytestring -> bytestring",
  },
  orByteString: {
    category: "ByteString",
    signature: "bool -> bytestring -> bytestring -> bytestring",
  },
  xorByteString: {
    category: "ByteString",
    signature: "bool -> bytestring -> bytestring -> bytestring",
  },
  complementByteString: {
    category: "ByteString",
    signature: "bytestring -> bytestring",
  },
  readBit: {
    category: "ByteString",
    signature: "bytestring -> integer -> bool",
  },
  writeBits: {
    category: "ByteString",
    signature: "bytestring -> list integer -> bool -> bytestring",
  },
  replicateByte: {
    category: "ByteString",
    signature: "integer -> integer -> bytestring",
  },
  shiftByteString: {
    category: "ByteString",
    signature: "bytestring -> integer -> bytestring",
  },
  rotateByteString: {
    category: "ByteString",
    signature: "bytestring -> integer -> bytestring",
  },
  countSetBits: {
    category: "ByteString",
    signature: "bytestring -> integer",
  },
  findFirstSetBit: {
    category: "ByteString",
    signature: "bytestring -> integer",
  },
  integerToByteString: {
    category: "ByteString",
    signature: "bool -> integer -> integer -> bytestring",
  },
  byteStringToInteger: {
    category: "ByteString",
    signature: "bool -> bytestring -> integer",
  },

  // Crypto (9)
  sha2_256: { category: "Crypto", signature: "bytestring -> bytestring" },
  sha3_256: { category: "Crypto", signature: "bytestring -> bytestring" },
  blake2b_256: { category: "Crypto", signature: "bytestring -> bytestring" },
  blake2b_224: { category: "Crypto", signature: "bytestring -> bytestring" },
  keccak_256: { category: "Crypto", signature: "bytestring -> bytestring" },
  ripemd_160: { category: "Crypto", signature: "bytestring -> bytestring" },
  verifyEd25519Signature: {
    category: "Crypto",
    signature: "bytestring -> bytestring -> bytestring -> bool",
  },
  verifyEcdsaSecp256k1Signature: {
    category: "Crypto",
    signature: "bytestring -> bytestring -> bytestring -> bool",
  },
  verifySchnorrSecp256k1Signature: {
    category: "Crypto",
    signature: "bytestring -> bytestring -> bytestring -> bool",
  },

  // String (4)
  appendString: {
    category: "String",
    signature: "string -> string -> string",
  },
  equalsString: { category: "String", signature: "string -> string -> bool" },
  encodeUtf8: { category: "String", signature: "string -> bytestring" },
  decodeUtf8: { category: "String", signature: "bytestring -> string" },

  // Control (3)
  ifThenElse: {
    category: "Control",
    signature: "forall a. bool -> a -> a -> a",
  },
  chooseUnit: { category: "Control", signature: "forall a. unit -> a -> a" },
  trace: { category: "Control", signature: "forall a. string -> a -> a" },

  // Pair (3)
  fstPair: { category: "Pair", signature: "forall a b. pair a b -> a" },
  sndPair: { category: "Pair", signature: "forall a b. pair a b -> b" },
  mkPairData: {
    category: "Pair",
    signature: "data -> data -> pair data data",
  },

  // List (6)
  chooseList: {
    category: "List",
    signature: "forall a b. list a -> b -> b -> b",
  },
  mkCons: { category: "List", signature: "forall a. a -> list a -> list a" },
  headList: { category: "List", signature: "forall a. list a -> a" },
  tailList: { category: "List", signature: "forall a. list a -> list a" },
  nullList: { category: "List", signature: "forall a. list a -> bool" },
  dropList: {
    category: "List",
    signature: "forall a. integer -> list a -> list a",
  },

  // Array (3)
  lengthOfArray: {
    category: "Array",
    signature: "forall a. array a -> integer",
  },
  listToArray: {
    category: "Array",
    signature: "forall a. list a -> array a",
  },
  indexArray: {
    category: "Array",
    signature: "forall a. array a -> integer -> a",
  },

  // Data (15)
  chooseData: {
    category: "Data",
    signature: "forall a. data -> a -> a -> a -> a -> a -> a",
  },
  constrData: { category: "Data", signature: "integer -> list data -> data" },
  mapData: { category: "Data", signature: "list (pair data data) -> data" },
  listData: { category: "Data", signature: "list data -> data" },
  iData: { category: "Data", signature: "integer -> data" },
  bData: { category: "Data", signature: "bytestring -> data" },
  unConstrData: {
    category: "Data",
    signature: "data -> pair integer (list data)",
  },
  unMapData: { category: "Data", signature: "data -> list (pair data data)" },
  unListData: { category: "Data", signature: "data -> list data" },
  unIData: { category: "Data", signature: "data -> integer" },
  unBData: { category: "Data", signature: "data -> bytestring" },
  equalsData: { category: "Data", signature: "data -> data -> bool" },
  serialiseData: { category: "Data", signature: "data -> bytestring" },
  mkNilData: { category: "Data", signature: "unit -> list data" },
  mkNilPairData: {
    category: "Data",
    signature: "unit -> list (pair data data)",
  },

  // BLS12-381 (19)
  bls12_381_G1_add: {
    category: "BLS12-381",
    signature:
      "bls12_381_G1_element -> bls12_381_G1_element -> bls12_381_G1_element",
  },
  bls12_381_G1_neg: {
    category: "BLS12-381",
    signature: "bls12_381_G1_element -> bls12_381_G1_element",
  },
  bls12_381_G1_scalarMul: {
    category: "BLS12-381",
    signature: "integer -> bls12_381_G1_element -> bls12_381_G1_element",
  },
  bls12_381_G1_equal: {
    category: "BLS12-381",
    signature: "bls12_381_G1_element -> bls12_381_G1_element -> bool",
  },
  bls12_381_G1_compress: {
    category: "BLS12-381",
    signature: "bls12_381_G1_element -> bytestring",
  },
  bls12_381_G1_uncompress: {
    category: "BLS12-381",
    signature: "bytestring -> bls12_381_G1_element",
  },
  bls12_381_G1_hashToGroup: {
    category: "BLS12-381",
    signature: "bytestring -> bytestring -> bls12_381_G1_element",
  },
  bls12_381_G1_multiScalarMul: {
    category: "BLS12-381",
    signature:
      "list integer -> list bls12_381_G1_element -> bls12_381_G1_element",
  },
  bls12_381_G2_add: {
    category: "BLS12-381",
    signature:
      "bls12_381_G2_element -> bls12_381_G2_element -> bls12_381_G2_element",
  },
  bls12_381_G2_neg: {
    category: "BLS12-381",
    signature: "bls12_381_G2_element -> bls12_381_G2_element",
  },
  bls12_381_G2_scalarMul: {
    category: "BLS12-381",
    signature: "integer -> bls12_381_G2_element -> bls12_381_G2_element",
  },
  bls12_381_G2_equal: {
    category: "BLS12-381",
    signature: "bls12_381_G2_element -> bls12_381_G2_element -> bool",
  },
  bls12_381_G2_compress: {
    category: "BLS12-381",
    signature: "bls12_381_G2_element -> bytestring",
  },
  bls12_381_G2_uncompress: {
    category: "BLS12-381",
    signature: "bytestring -> bls12_381_G2_element",
  },
  bls12_381_G2_hashToGroup: {
    category: "BLS12-381",
    signature: "bytestring -> bytestring -> bls12_381_G2_element",
  },
  bls12_381_G2_multiScalarMul: {
    category: "BLS12-381",
    signature:
      "list integer -> list bls12_381_G2_element -> bls12_381_G2_element",
  },
  bls12_381_millerLoop: {
    category: "BLS12-381",
    signature:
      "bls12_381_G1_element -> bls12_381_G2_element -> bls12_381_mlresult",
  },
  bls12_381_mulMlResult: {
    category: "BLS12-381",
    signature: "bls12_381_mlresult -> bls12_381_mlresult -> bls12_381_mlresult",
  },
  bls12_381_finalVerify: {
    category: "BLS12-381",
    signature: "bls12_381_mlresult -> bls12_381_mlresult -> bool",
  },

  // Value (7)
  insertCoin: {
    category: "Value",
    signature: "bytestring -> bytestring -> integer -> value -> value",
  },
  lookupCoin: {
    category: "Value",
    signature: "bytestring -> bytestring -> value -> integer",
  },
  unionValue: { category: "Value", signature: "value -> value -> value" },
  valueContains: { category: "Value", signature: "value -> value -> bool" },
  valueData: { category: "Value", signature: "value -> data" },
  unValueData: { category: "Value", signature: "data -> value" },
  scaleValue: { category: "Value", signature: "integer -> value -> value" },
};

export function builtinCategory(fn: DefaultFunction): BuiltinCategory {
  return BUILTIN_META[fn].category;
}

export function builtinSignature(fn: DefaultFunction): string {
  return BUILTIN_META[fn].signature;
}
