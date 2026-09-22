import type {VariantContext, VariantInstance, VariantModule} from '../types';
import {PRESETS} from './presets';
import {CarouselScene} from './scene';

/**
 * The `carousel` mechanic: copies of the pack turn on a stage, one is
 * tapped, lifted and talked about — its facts, its tier — and then flips
 * into the card. `CarouselScene` does the drawing; this file is only the
 * declaration that makes it a variant.
 */
export const carousel: VariantModule = {
  id: 'carousel',
  presets: PRESETS,
  defaultPreset: 'showcase',
  create({app, texture, options, emit}: VariantContext): VariantInstance {
    return new CarouselScene(app, texture, options, emit);
  },
};

export default carousel;
