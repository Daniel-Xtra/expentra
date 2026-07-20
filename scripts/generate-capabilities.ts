#!/usr/bin/env ts-node
/**
 * Generates frontend capability constants from the permission registry.
 * Run: npm run generate:capabilities
 */
import fs from 'fs';
import path from 'path';
import { listAllCapabilityKeys } from '../src/modules/authorization/registry/permission.registry';

const outputPath = path.resolve(
  __dirname,
  '../../expentra-web/src/shared/lib/generated-capabilities.ts',
);

const keys = listAllCapabilityKeys();

const contents = `/** AUTO-GENERATED — do not edit. Run \`npm run generate:capabilities\` in expentra. */
export const GENERATED_CAPABILITY_KEYS = ${JSON.stringify(keys, null, 2)} as const;

export type GeneratedCapabilityKey = (typeof GENERATED_CAPABILITY_KEYS)[number];
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, contents, 'utf8');
console.log(`Wrote ${keys.length} capability keys to ${path.relative(process.cwd(), outputPath)}`);
