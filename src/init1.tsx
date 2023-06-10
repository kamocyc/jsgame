import { render } from 'preact';
import { App } from './components/app';

export function init1() {
  render(<App />, document.getElementById('editor-root') as HTMLElement);
}
