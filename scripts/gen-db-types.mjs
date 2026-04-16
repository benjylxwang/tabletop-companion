/**
 * Generates shared/src/database.types.ts from supabase/migrations/*.sql.
 * Run with: pnpm gen:types
 * No live database or credentials required — parses SQL files statically.
 */

import { parse } from 'pgsql-ast-parser';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Columns whose values are assigned by a DB trigger on INSERT, not by a DEFAULT
// clause. They are optional in the Insert type even though the column is NOT NULL.
const TRIGGER_ASSIGNED = {
  sessions: new Set(['session_number']),
};

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

function pgTypeToTs(dataType) {
  if (dataType.kind === 'array') return 'string[]';
  switch ((dataType.name ?? '').toLowerCase()) {
    case 'uuid':
    case 'text':
    case 'varchar':
    case 'char':
    case 'timestamptz':
    case 'timestamp':
    case 'date':
    case 'time':
    case 'interval':
      return 'string';
    case 'integer':
    case 'int':
    case 'int2':
    case 'int4':
    case 'int8':
    case 'bigint':
    case 'smallint':
    case 'numeric':
    case 'decimal':
    case 'real':
    case 'float4':
    case 'float8':
    case 'double':
    case 'double precision':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'jsonb':
    case 'json':
      return 'Json';
    default:
      return 'string';
  }
}

// Extract string literal union from a CHECK (col IN ('a','b','c')) constraint.
function extractEnum(constraints) {
  for (const c of constraints ?? []) {
    if (
      c.type === 'check' &&
      c.expr?.type === 'binary' &&
      c.expr.op === 'IN' &&
      c.expr.right?.type === 'list'
    ) {
      const vals = c.expr.right.expressions
        .filter((e) => e.type === 'string')
        .map((e) => `'${e.value}'`);
      if (vals.length) return vals.join(' | ');
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Column entry building and table emission
// ---------------------------------------------------------------------------

function buildColumnEntry(col, triggerAssigned) {
  const colName = col.name.name;
  const constraints = col.constraints ?? [];

  const isNotNull = constraints.some(
    (c) => c.type === 'not null' || c.type === 'primary key',
  );
  const hasDefault =
    constraints.some((c) => c.type === 'default' || c.type === 'primary key') ||
    triggerAssigned.has(colName);
  const fk = constraints.find((c) => c.type === 'reference');
  const enumLiteral = extractEnum(constraints);

  const baseType = enumLiteral ?? pgTypeToTs(col.dataType);
  const nullableSuffix = isNotNull ? '' : ' | null';

  return { colName, baseType, nullableSuffix, isNotNull, hasDefault, fk };
}

function emitTable(tableName, columnEntries) {
  const rowFields = [];
  const insertFields = [];
  const updateFields = [];
  const relationships = [];

  for (const { colName, baseType, nullableSuffix, isNotNull, hasDefault, fk } of columnEntries) {
    rowFields.push(`          ${colName}: ${baseType}${nullableSuffix}`);

    if (hasDefault) {
      insertFields.push(`          ${colName}?: ${baseType}${nullableSuffix}`);
    } else if (isNotNull) {
      insertFields.push(`          ${colName}: ${baseType}`);
    } else {
      insertFields.push(`          ${colName}?: ${baseType} | null`);
    }

    updateFields.push(`          ${colName}?: ${baseType}${nullableSuffix}`);

    if (fk) {
      const refTable = fk.foreignTable.schema
        ? `${fk.foreignTable.schema}.${fk.foreignTable.name}`
        : fk.foreignTable.name;
      const refCol = fk.foreignColumns?.[0]?.name ?? 'id';
      const fkName = `${tableName}_${colName}_fkey`;
      relationships.push(
        `          {
            foreignKeyName: "${fkName}"
            columns: ["${colName}"]
            isOneToOne: false
            referencedRelation: "${refTable}"
            referencedColumns: ["${refCol}"]
          }`,
      );
    }
  }

  const relStr =
    relationships.length > 0
      ? `[\n${relationships.join(',\n')}\n        ]`
      : '[]';

  return `      ${tableName}: {
        Row: {
${rowFields.join('\n')}
        }
        Insert: {
${insertFields.join('\n')}
        }
        Update: {
${updateFields.join('\n')}
        }
        Relationships: ${relStr}
      }`;
}

// ---------------------------------------------------------------------------
// Extract CREATE TABLE blocks from SQL
// pgsql-ast-parser does not support PL/pgSQL function bodies or trigger DDL,
// so we extract only the CREATE TABLE statements before parsing.
// ---------------------------------------------------------------------------

function extractCreateTableSql(sql) {
  const blocks = [];
  const lower = sql.toLowerCase();
  let i = 0;

  while (i < sql.length) {
    const idx = lower.indexOf('create table', i);
    if (idx === -1) break;

    // Find the opening paren of the column list
    const parenStart = sql.indexOf('(', idx);
    if (parenStart === -1) break;

    // Walk to the matching closing paren (handle nested parens)
    let depth = 0;
    let j = parenStart;
    while (j < sql.length) {
      if (sql[j] === '(') depth++;
      else if (sql[j] === ')') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }

    // Include the trailing semicolon
    const semiIdx = sql.indexOf(';', j);
    if (semiIdx === -1) break;

    blocks.push(sql.substring(idx, semiIdx + 1));
    i = semiIdx + 1;
  }

  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Apply ALTER TABLE ... ADD COLUMN statements to the table registry.
// Uses regex (not AST) because pgsql-ast-parser may not handle IF NOT EXISTS.
// Handles: ALTER TABLE <tbl> ADD COLUMN [IF NOT EXISTS] <col> <type>;
// ---------------------------------------------------------------------------

function applyAlterTableAddColumns(allSql, tableRegistry) {
  // Matches: alter table <name> add column [if not exists] <colname> <type+constraints>;
  // Uses [^;]+ to capture multi-word types like "double precision".
  const pattern =
    /alter\s+table\s+(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+([^;]+);/gi;

  let match;
  while ((match = pattern.exec(allSql)) !== null) {
    const [, tableName, colName, typeAndConstraints] = match;
    const tableData = tableRegistry.get(tableName);
    if (!tableData) continue;

    // Skip if column already present (idempotent)
    if (tableData.columnEntries.some((c) => c.colName === colName)) continue;

    // Strip trailing constraint keywords (NOT NULL, DEFAULT, REFERENCES, etc.)
    // to isolate the bare data type, then normalise whitespace.
    const pgTypeName = typeAndConstraints
      .trim()
      .replace(/\s+(not\s+null|null|default|references|check|unique|primary\s+key)\b.*/i, '')
      .trim()
      .toLowerCase();

    const baseType = pgTypeToTs({ name: pgTypeName, kind: 'simple' });
    tableData.columnEntries.push({
      colName,
      baseType,
      nullableSuffix: ' | null', // ADD COLUMN without NOT NULL is nullable
      isNotNull: false,
      hasDefault: false,
      fk: null,
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const migrationsDir = join(ROOT, 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let allSql = '';
for (const file of migrationFiles) {
  allSql += readFileSync(join(migrationsDir, file), 'utf-8') + '\n';
}

// 1. Parse CREATE TABLE → build table registry preserving creation order
const createTableSql = extractCreateTableSql(allSql);
const ast = parse(createTableSql);
const createTables = ast.filter((s) => s.type === 'create table');

/** @type {Map<string, { triggerAssigned: Set<string>, columnEntries: object[] }>} */
const tableRegistry = new Map();
for (const node of createTables) {
  const tableName = node.name.name;
  const triggerAssigned = TRIGGER_ASSIGNED[tableName] ?? new Set();
  const columns = (node.columns ?? []).filter((c) => c.kind === 'column');
  tableRegistry.set(tableName, {
    triggerAssigned,
    columnEntries: columns.map((col) => buildColumnEntry(col, triggerAssigned)),
  });
}

// 2. Apply ALTER TABLE ADD COLUMN modifications
applyAlterTableAddColumns(allSql, tableRegistry);

// 3. Emit TypeScript
const tableEntries = Array.from(tableRegistry.entries())
  .map(([tableName, { columnEntries }]) => emitTable(tableName, columnEntries))
  .join('\n');

const output = `// AUTO-GENERATED from supabase/migrations — do not edit manually.
// Regenerate: pnpm gen:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tableEntries}
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
`;

const outputPath = join(ROOT, 'shared/src/database.types.ts');
writeFileSync(outputPath, output, 'utf-8');
console.log(`Generated ${outputPath} (${tableRegistry.size} tables)`);
