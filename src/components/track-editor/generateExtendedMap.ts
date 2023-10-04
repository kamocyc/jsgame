import { ExtendedGameMap } from '../../mapEditorModel';
import { perlin2, seed } from '../../perlin';

// オクターブをする (https://qiita.com/keny30827/items/f4e29a4a90779cf94da6#%E3%82%AA%E3%82%AF%E3%82%BF%E3%83%BC%E3%83%96%E3%83%90%E3%83%AA%E3%83%A5%E3%83%BC%E3%83%8E%E3%82%A4%E3%82%BA のコードの移植)
function perlin2Octave(x: number, y: number): number {
  let a = 1;
  let f = 1 / 8; // TODO
  let maxValue = 0;
  let totalValue = 0;
  let per = 0.5;
  for (let i = 0; i < 5; i++) {
    totalValue += a * perlin2(x * f, y * f);
    maxValue += a;
    a *= per;
    f *= 2;
  }
  return totalValue / maxValue;
}

export function generateTerrain(extendedMap: ExtendedGameMap) {
  seed(Math.random());

  for (let x = 0; x < extendedMap.length; x++) {
    for (let y = 0; y < extendedMap[0].length; y++) {
      const extendedCell = extendedMap[x][y];
      const perlinValue = Math.abs(perlin2Octave(x / 10, y / 10));
      if (perlinValue < 0.1) {
        extendedCell.terrain = 'Water';
      } else if (perlinValue < 0.28) {
        extendedCell.terrain = 'Grass';
      } else {
        extendedCell.terrain = 'Mountain';
      }
    }
  }
}
