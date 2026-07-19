import { z } from "zod";

/**
 * Schema for the compact Godot symbol database produced by
 * scripts/generate-symbol-db.ts from `godot --dump-extension-api`. Only the
 * fields needed for API lookup and cross-version diffing are kept; hashes,
 * memory offsets, class sizes, and native structures are stripped.
 *
 * Bump SCHEMA_VERSION when the shape changes so stale artifacts fail validation.
 */
export const SCHEMA_VERSION = 1;

const argSchema = z.object({
  name: z.string(),
  type: z.string(),
  /** Default value as Godot renders it, e.g. "false", "0", "Vector2(0, 0)". */
  default: z.string().optional(),
});
export type SymbolArg = z.infer<typeof argSchema>;

const methodSchema = z.object({
  name: z.string(),
  /** Return type name, or null for void. */
  ret: z.string().nullable(),
  args: z.array(argSchema),
  isConst: z.boolean().optional(),
  isStatic: z.boolean().optional(),
  isVirtual: z.boolean().optional(),
  isVararg: z.boolean().optional(),
});
export type Method = z.infer<typeof methodSchema>;

const propertySchema = z.object({
  name: z.string(),
  type: z.string(),
  getter: z.string().optional(),
  setter: z.string().optional(),
});
export type Property = z.infer<typeof propertySchema>;

const signalSchema = z.object({
  name: z.string(),
  args: z.array(argSchema),
});
export type Signal = z.infer<typeof signalSchema>;

const enumSchema = z.object({
  name: z.string(),
  isBitfield: z.boolean().optional(),
  values: z.array(z.object({ name: z.string(), value: z.number() })),
});
export type EnumDef = z.infer<typeof enumSchema>;

const classConstantSchema = z.object({ name: z.string(), value: z.number() });

const classSchema = z.object({
  inherits: z.string().nullable(),
  apiType: z.string(),
  isRefcounted: z.boolean().optional(),
  isInstantiable: z.boolean().optional(),
  methods: z.array(methodSchema),
  properties: z.array(propertySchema),
  signals: z.array(signalSchema),
  enums: z.array(enumSchema),
  constants: z.array(classConstantSchema),
});
export type ClassDef = z.infer<typeof classSchema>;

const builtinOperatorSchema = z.object({
  name: z.string(),
  right: z.string().nullable(),
  ret: z.string(),
});

const builtinConstantSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.string(),
});

const builtinClassSchema = z.object({
  members: z.array(z.object({ name: z.string(), type: z.string() })),
  constants: z.array(builtinConstantSchema),
  enums: z.array(enumSchema),
  operators: z.array(builtinOperatorSchema),
  methods: z.array(methodSchema),
  isKeyed: z.boolean().optional(),
});
export type BuiltinClassDef = z.infer<typeof builtinClassSchema>;

const utilityFunctionSchema = z.object({
  name: z.string(),
  ret: z.string().nullable(),
  category: z.string(),
  args: z.array(argSchema),
  isVararg: z.boolean().optional(),
});
export type UtilityFunction = z.infer<typeof utilityFunctionSchema>;

const metaSchema = z.object({
  /** Full patch version, e.g. "4.4.1". */
  godotVersion: z.string(),
  /** Minor-line label used to name the artifact, e.g. "4.4". */
  versionLabel: z.string(),
  /** Godot's own version string, e.g. "4.4.1.stable.official". */
  versionFull: z.string(),
  /** Release tag the binary came from, e.g. "4.4.1-stable". */
  releaseTag: z.string().nullable(),
  /** Downloaded archive filename, if the binary was fetched. */
  archiveName: z.string().nullable(),
  /** SHA-256 of the downloaded archive, if fetched. */
  archiveSha256: z.string().nullable(),
  /** Provenance of the binary, e.g. "godotengine/godot-builds" or "local". */
  source: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.string(),
});
export type SymbolDbMeta = z.infer<typeof metaSchema>;

export const symbolDbSchema = z.object({
  meta: metaSchema,
  classes: z.record(z.string(), classSchema),
  builtinClasses: z.record(z.string(), builtinClassSchema),
  utilityFunctions: z.array(utilityFunctionSchema),
  globalEnums: z.array(enumSchema),
  singletons: z.array(z.object({ name: z.string(), type: z.string() })),
});
export type SymbolDb = z.infer<typeof symbolDbSchema>;

/** Parse and validate an already-decompressed DB object. Throws on mismatch. */
export function parseSymbolDb(data: unknown): SymbolDb {
  return symbolDbSchema.parse(data);
}
