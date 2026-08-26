import type {VariantContext, VariantInstance, VariantModule} from '../types';
import {PRESETS} from './presets';
import {PackScene} from './scene';

/**
 * The `slice` mechanic: the seal is cut with a finger, the lid tears away and
 * the card unveils itself. `PackScene` does the drawing; this file is only the
 * declaration that makes it a variant.
 */
export const slice: VariantModule = {
  id: 'slice',
  presets: PRESETS,
  defaultPreset: 'classic',
  create({app, texture, options, emit}: VariantContext): VariantInstance {
    return new PackScene(app, texture, options, emit);
  },
};

export default slice;
