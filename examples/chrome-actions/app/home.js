import { shellui } from '@shellui/sdk';

const logEl = document.getElementById('log');

function log(message) {
  if (logEl) logEl.textContent = message;
}

function setDefaultActions(variant = 'default') {
  const title = variant === 'updated' ? 'Inbox · updated' : 'Inbox';
  shellui.actions.set({
    back: {
      id: 'back',
      onClick: () => log('Clicked: back'),
    },
    title,
    trailing: [
      {
        id: 'edit',
        label: variant === 'updated' ? 'Rename' : 'Edit',
        onClick: () => log('Clicked: edit'),
      },
      { id: 'share', label: 'Share', onClick: () => log('Clicked: share') },
      { id: 'filter', label: 'Filter', onClick: () => log('Clicked: filter') },
      { id: 'extra', label: 'Archive', onClick: () => log('Clicked: archive (overflow)') },
    ],
    primary: {
      id: 'compose',
      icon: 'plus',
      label: 'Compose',
      onClick: () => log('Clicked: primary FAB'),
    },
  });
  log(`Actions ${variant === 'updated' ? 'updated' : 'set'} (back + title + trailing + FAB).`);
}

await shellui.init();
setDefaultActions();

document.getElementById('btn-set')?.addEventListener('click', () => setDefaultActions());
document
  .getElementById('btn-update')
  ?.addEventListener('click', () => setDefaultActions('updated'));
document.getElementById('btn-clear')?.addEventListener('click', () => {
  shellui.actions.clear();
  log('Actions cleared.');
});

window.addEventListener('pagehide', () => {
  shellui.actions.clear();
});
