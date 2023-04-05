import * as engine from 'glov/client/engine.js';
import { ALIGN } from 'glov/client/font.js';
import { localStorageGetJSON } from 'glov/client/local_storage.js';
import * as ui from 'glov/client/ui.js';
import * as urlhash from 'glov/client/urlhash.js';
import { createAccountUI } from './account_ui.js';
import { crawlerCommStart, crawlerCommStartup, crawlerCommWant } from './crawler_comm.js';
import {
  SavedGameData,
  crawlerPlayWantMode,
  crawlerPlayWantNewGame,
} from './crawler_play.js';
import * as main from './main.js';
import { tickMusic } from './play.js';


const { max } = Math;

type AccountUI = ReturnType<typeof createAccountUI>;

let account_ui: AccountUI;

function title(dt: number): void {
  main.chat_ui.run({
    hide: true,
  });

  tickMusic(true, false);

  let y = 40;
  if (engine.DEBUG || true) {
    let next_y = account_ui.showLogin({
      x: 10,
      y: 10,
      pad: 2,
      text_w: 120,
      label_w: 80,
      style: null,
      center: false,
      button_width: ui.button_width,
      font_height_small: ui.font_height,
    });

    y = max(next_y + 2, y);
  }

  let x = 10;
  ui.print(null, x, y, Z.UI, 'Dungeon Crawler Jam 2023');
  x += 10;
  y += ui.font_height + 2;
  for (let ii = 0; ii < 3; ++ii) {
    let slot = ii + 1;
    let yy = y;
    ui.font.draw({
      align: ALIGN.HCENTER, w: ui.button_width,
      x, y: yy,
      text: `Slot ${slot}`,
    });
    yy += ui.button_height;
    let manual_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.manual`, {});
    let auto_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.auto`, {});

    if (ui.buttonText({
      x, y: yy, text: 'New Game',
    })) {
      if (manual_data.timestamp || auto_data.timestamp) {
        ui.modalDialog({
          text: 'This will overwrite your existing game when you next save.  Continue?',
          buttons: {
            yes: function () {
              crawlerPlayWantNewGame();
              urlhash.go(`?c=local&slot=${slot}`);
            },
            no: null,
          }
        });
      } else {
        crawlerPlayWantNewGame();
        urlhash.go(`?c=local&slot=${slot}`);
      }
    }
    yy += ui.button_height + 2;

    if (ui.buttonText({
      x, y: yy, text: 'Load Game',
      disabled: !manual_data.timestamp
    })) {
      crawlerPlayWantMode('manual');
      urlhash.go(`?c=local&slot=${slot}`);
    }
    yy += ui.button_height;
    if (manual_data.timestamp) {
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(manual_data.timestamp).toLocaleDateString(),
      });
      yy += ui.font_height;
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(manual_data.timestamp).toLocaleTimeString(),
      });
      yy += ui.font_height;
    }
    yy += 2;

    if (ui.buttonText({
      x, y: yy, text: 'Load Autosave',
      disabled: !auto_data.timestamp
    })) {
      crawlerPlayWantMode('auto');
      urlhash.go(`?c=local&slot=${slot}`);
    }
    yy += ui.button_height;
    if (auto_data.timestamp) {
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(auto_data.timestamp).toLocaleDateString(),
      });
      yy += ui.font_height;
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(auto_data.timestamp).toLocaleTimeString(),
      });
      yy += ui.font_height;
    }

    x += ui.button_width + 4;
  }
  x = 10;
  y += ui.button_height * 3 + 6;
  // if (netSubs().loggedIn()) {
  //   if (ui.buttonText({
  //     x, y, text: 'Online Test',
  //   })) {
  //     urlhash.go('?c=build');
  //   }
  //   y += ui.button_height + 2;
  // }
  if (crawlerCommWant()) {
    crawlerCommStart();
  }
}

export function titleInit(dt: number): void {
  account_ui = account_ui || createAccountUI();
  engine.setState(title);
  title(dt);
}

export function titleStartup(): void {
  crawlerCommStartup({
    lobby_state: titleInit,
    title_func: (value: string) => `Crawler Demo | "${value}"`,
    chat_ui: main.chat_ui,
  });
}
