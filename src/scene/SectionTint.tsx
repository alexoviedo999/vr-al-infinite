import { useFrame, useThree } from '@react-three/fiber';
import { getRailSections } from '../rail/RailMover';
import { playerTRef } from '../rail/railStore';
import { sectionAt } from '../rail/sectionVelocity';
import { SECTION_FOG } from './sectionLook';

/**
 * Drives fog (and the clear color if fog is present) from the active
 * Music Map section. Writes through the scene object — no setState.
 */
export function SectionTint() {
  const { scene } = useThree();

  useFrame(() => {
    const section = sectionAt(playerTRef.current, getRailSections());
    const hex = SECTION_FOG[section?.name ?? 'intro'];
    const fog = scene.fog;
    if (fog && 'color' in fog) fog.color.set(hex);
  });

  return null;
}
