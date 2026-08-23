import type { BildRolle } from './types';

/** Rolle wird automatisch aus dem Seitenverhältnis klassifiziert (siehe Konzept: Layout & Bildplatzierung). */
export function classifyImageRole(width: number, height: number): BildRolle {
	const ratio = width / height;
	if (ratio >= 2) return 'bannerBreit';
	if (ratio <= 0.5) return 'bannerHoch';
	return 'bild';
}
