import type {VariantContext, VariantInstance, VariantModule} from '../types';
import {PRESETS} from './presets';
import {BurstScene} from './scene';

/**
 * The `burst` mechanic: the pack is held under a finger until the pressure
 * gives, then blows apart and the card climbs out of the flash. `BurstScene`
 * does the drawing; this file is only the declaration that makes it a variant.
 */
export const burst: VariantModule = {
  id: 'burst',
  presets: PRESETS,
  defaultPreset: 'charged',
  create({app, texture, options, emit}: VariantContext): VariantInstance {
    return new BurstScene(app, texture, options, emit);
  },
};

export default burst;
