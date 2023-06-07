import { render } from 'preact';
import { App } from './test1';

export function init1() {
  render(<App />, document.getElementById('app') as HTMLElement);
}
