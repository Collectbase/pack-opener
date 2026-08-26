import type {VariantModule} from './types';
import {slice} from './slice';

/**
 * Every mechanic the package knows. A new animation style registers here and
 * nothing else in the engine or the wrappers changes.
 */
export const VARIANTS: Record<string, VariantModule> = {
  [slice.id]: slice,
};

export const DEFAULT_VARIANT = slice.id;

export const variantOf = (name?: string): VariantModule =>
  (name && VARIANTS[name]) || VARIANTS[DEFAULT_VARIANT];

export type {VariantContext, VariantInstance, VariantModule} from './types';
