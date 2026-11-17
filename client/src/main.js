import RAPIER from '@dimforge/rapier3d-compat';
import { CITY_ARENA } from '@comic-strike/shared/map.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { Sfx } from './core/Audio.js';
import { Physics } from './world/Physics.js';
import { buildMap } from './world/MapBuilder.js';
import { Network } from './net/Network.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { loadSettings } from './ui/settings.js';
import { Game } from './Game.js';

async function boot() {
  const settings = loadSettings();
  const canvas = document.getElementById('game');
  const view = new Renderer(canvas, settings);

  await RAPIER.init();
  const physics = new Physics();
  buildMap(CITY_ARENA, view.scene, physics);
  physics.step();

  // Çizgi roman fontu canvas yazılarında da kullanılsın diye yüklenmesini bekle (en fazla 1.5 sn)
  try {
    await Promise.race([document.fonts.load('40px Bangers'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* font yoksa Impact kullanılır */
  }

  const input = new Input(canvas);
  const sfx = new Sfx();
  sfx.setVolume(settings.volume);
  const hud = new HUD();
  const net = new Network();
  const game = new Game({ view, physics, input, sfx, hud, net, settings });
  const menu = new Menu({ net, game, input, sfx, settings, view });
  menu.show('main');
  menu.checkServer();
  window.__comic = { game, menu, view }; // tarayıcı konsolundan hata ayıklamak için

  // Ana döngü
  let last = performance.now();
  let orbit = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.active) {
      physics.step();
      game.update(dt);
    } else {
      // Menü arkasında haritanın üzerinde yavaşça dönen kamera
      orbit += dt * 0.06;
      view.camera.position.set(Math.sin(orbit) * 24, 19, Math.cos(orbit) * 34);
      view.camera.rotation.set(0, 0, 0);
      view.camera.lookAt(0, 2, 0);
    }
    view.render(game.active ? game.weapon : null);
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  const m = document.getElementById('loading-msg');
  if (m) m.textContent = `Hata: ${err.message}`;
});
