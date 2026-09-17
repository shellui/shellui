import Alpine from 'alpinejs';
import { shellui } from '@shellui/sdk/tiny';
import './style.css';

// Light Shellui host handshake when embedded (no-op outside the shell).
void shellui.ready;

window.Alpine = Alpine;
Alpine.start();
