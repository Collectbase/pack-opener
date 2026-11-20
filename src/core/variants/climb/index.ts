import type {VariantContext, VariantInstance, VariantModule} from '../types';
import {PRESETS} from './presets';
import {ClimbScene} from './scene';

/**
 * The `climb` mechanic ("Rarity Climb"): the whole purchase opens on one
 * stage, a grid of the packs bought that spin in changing colours, stop on
 * their tier's and turn into their cards. `ClimbScene` does the drawing; this
 * file is only the declaration that makes it a variant.
 */
export const climb: VariantModule = {
  id: 'climb',
  presets: PRESETS,
  defaultPreset: 'spectrum',
  create({app, texture, options, emit}: VariantContext): VariantInstance {
    return new ClimbScene(app, texture, options, emit);
  },
};

export default climb;
