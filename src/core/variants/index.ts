import type {VariantModule} from './types';
import {burst} from './burst';
import {carousel} from './carousel';
import {climb} from './climb';
import {slice} from './slice';

/**
 * Every mechanic the package knows. A new animation style registers here;
 * the engine and the wrappers change only for a command their handle does
 * not offer yet (see `VariantInstance`).
 */
export const VARIANTS: Record<string, VariantModule> = {
  [slice.id]: slice,
  [burst.id]: burst,
  [carousel.id]: carousel,
  [climb.id]: climb,
};

export const DEFAULT_VARIANT = slice.id;

export const variantOf = (name?: string): VariantModule =>
  (name && VARIANTS[name]) || VARIANTS[DEFAULT_VARIANT];

export type {VariantContext, VariantInstance, VariantModule} from './types';
