import { JSON_decycle, JSON_retrocycle } from './cycle.js';
import { TrainMove } from './trainMove.js';

export function toJSON(trainMove: TrainMove) {
  const json = JSON.stringify(JSON_decycle(trainMove));
  return json;
}

export function fromJSON(json: string) {
  const obj = JSON_retrocycle(JSON.parse(json));
  return obj;
}
