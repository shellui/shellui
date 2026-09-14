import { shellui } from '@shellui/sdk';

const logEl = document.getElementById('log');

function log(message) {
  if (logEl) logEl.textContent = message;
}

await shellui.init();

shellui.actions.set({
  back: {
    id: 'second-back',
    onClick: () => {
      log('Clicked: back (second view)');
      shellui.navigate('/');
    },
  },
  title: 'Second view',
  trailing: [{ id: 'info', label: 'Info', onClick: () => log('Clicked: info') }],
  primary: {
    id: 'second-fab',
    icon: 'plus',
    onClick: () => log('Clicked: second FAB'),
  },
});

log('Second view actions set.');

document.getElementById('btn-clear')?.addEventListener('click', () => {
  shellui.actions.clear();
  log('Second view actions cleared.');
});

window.addEventListener('pagehide', () => {
  shellui.actions.clear();
});
