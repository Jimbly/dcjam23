import { AnimationSequencer, animationSequencerCreate } from 'glov/client/animation.js';
import * as engine from 'glov/client/engine.js';
import { ALIGN } from 'glov/client/font.js';
import {
  KEYS,
  eatAllInput,
  keyDown,
  mouseDownAnywhere,
} from 'glov/client/input.js';
import { localStorageGetJSON } from 'glov/client/local_storage.js';
import { Sprite, spriteCreate } from 'glov/client/sprites.js';
import * as ui from 'glov/client/ui.js';
import * as urlhash from 'glov/client/urlhash.js';
import { ROVec4 } from 'glov/common/vmath.js';
import { createAccountUI } from './account_ui.js';
import { crawlerCommStart, crawlerCommStartup, crawlerCommWant } from './crawler_comm.js';
import {
  SavedGameData,
  crawlerPlayWantMode,
  crawlerPlayWantNewGame,
} from './crawler_play.js';
import * as dawnbringer from './dawnbringer32';
import { game_height, game_width } from './globals.js';
import * as main from './main.js';
import { tickMusic } from './play.js';


const { floor, max } = Math;

type AccountUI = ReturnType<typeof createAccountUI>;

let splash_text: Sprite;
let splash_logo: Sprite;
let account_ui: AccountUI;

let title_anim: AnimationSequencer | null = null;
let title_alpha = {
  title: 0,
  sub: 0,
  button: 0,
};

function title(dt: number): void {
  const { font } = ui;
  main.chat_ui.run({
    hide: true,
  });

  if (title_anim) {
    if (keyDown(KEYS.SHIFT) || mouseDownAnywhere()) {
      dt = 100000;
    }
    if (!title_anim.update(dt)) {
      title_anim = null;
    } else {
      eatAllInput();
    }
  }

  tickMusic(true, false);

  let y = 40;
  if (engine.DEBUG) {
    let next_y = account_ui.showLogin({
      x: 1,
      y: 1,
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

  y = 10;
  // font.draw({
  //   // style: style_title,
  //   color: dawnbringer.font_colors[27],
  //   alpha: title_alpha.title,
  //   x: 0, y, w: game_width, align: ALIGN.HCENTER|ALIGN.HWRAP,
  //   size: 22,
  //   text: 'Uncharted\nWanders',
  // });
  splash_text.draw({
    color: [1,1,1,title_alpha.title],
    x: floor((game_width - 192)/2),
    y: 11,
    w: 192, h: 79,
  });
  splash_logo.draw({
    color: [1,1,1,title_alpha.title],
    x: floor((game_width - 32)/2),
    y: 81,
    w: 32, h: 32,
  });

  y = game_height - ui.button_height * 2 - ui.font_height * 4 - 12;
  font.draw({
    //style: label_style2,
    color: dawnbringer.font_colors[22],
    alpha: title_alpha.sub,
    x: 0, y, w: game_width, align: ALIGN.HCENTER,
    text: 'By Jimb Esser, Alex Hamadey, and Nick Duguid',
  });
  y += ui.font_height + 2;
  font.draw({
    //style: label_style2,
    color: dawnbringer.font_colors[22],
    alpha: title_alpha.sub,
    x: 0, y, w: game_width, align: ALIGN.HCENTER,
    text: 'And much art from Dungeon Crawl Stone Soup',
  });
  y += ui.font_height + 4;

  x += 10;
  x = floor((game_width - ui.button_width) / 2);
  if (title_alpha.button) {
    let color = title_alpha.button !== 1 ? [1,1,1, title_alpha.button] as ROVec4 : undefined;
    let slot = 1;
    let yy = y;
    let ymax = y;
    // ui.font.draw({
    //   align: ALIGN.HCENTER, w: ui.button_width,
    //   x, y: yy,
    //   text: `Slot ${slot}`,
    // });
    // yy += ui.button_height;
    let manual_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.manual`, { timestamp: 0 });
    let auto_data = localStorageGetJSON<SavedGameData>(`savedgame_${slot}.auto`, { timestamp: 0 });

    if (ui.buttonText({
      x: x - ui.button_width - 2, y: yy, text: 'New Game',
      color,
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
    ymax = max(ymax, yy);

    yy = y;
    if (ui.buttonText({
      x, y: yy, text: 'Load Game',
      disabled: !manual_data.timestamp,
      color,
    })) {
      crawlerPlayWantMode('manual');
      urlhash.go(`?c=local&slot=${slot}`);
    }
    yy += ui.button_height;
    if (manual_data.timestamp) {
      ui.font.draw({
        alpha: title_alpha.button,
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(manual_data.timestamp).toLocaleDateString(),
      });
      yy += ui.font_height;
      ui.font.draw({
        alpha: title_alpha.button,
        align: ALIGN.HCENTER, w: ui.button_width,
        x, y: yy,
        text: new Date(manual_data.timestamp).toLocaleTimeString(),
      });
      yy += ui.font_height;
    }
    yy += 2;
    ymax = max(ymax, yy);

    yy = y;
    let xx = x + ui.button_width + 2;
    if (ui.buttonText({
      x: xx, y: yy, text: 'Load Autosave',
      disabled: !auto_data.timestamp,
      color,
    })) {
      crawlerPlayWantMode('auto');
      urlhash.go(`?c=local&slot=${slot}`);
    }
    yy += ui.button_height + 2;
    if (auto_data.timestamp) {
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x: xx, y: yy,
        text: new Date(auto_data.timestamp).toLocaleDateString(),
      });
      yy += ui.font_height;
      ui.font.draw({
        align: ALIGN.HCENTER, w: ui.button_width,
        x: xx, y: yy,
        text: new Date(auto_data.timestamp).toLocaleTimeString(),
      });
      yy += ui.font_height;
    }
    yy += 2;
    ymax = max(ymax, yy);


    // x += ui.button_width + 4;
    y = ymax;

    if (ui.buttonText({
      x, y,
      text: 'Hall of Fame',
      color,
    })) {
      //
    }
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
  title_anim = animationSequencerCreate();
  let t = title_anim.add(0, 300, (progress) => {
    title_alpha.title = progress;
  });
  // t = title_anim.add(t + 200, 1000, (progress) => {
  //   title_alpha.desc = progress;
  // });
  t = title_anim.add(t + 300, 300, (progress) => {
    title_alpha.sub = progress;
  });
  title_anim.add(t + 500, 300, (progress) => {
    title_alpha.button = progress;
  });

  account_ui = account_ui || createAccountUI();
  engine.setState(title);
  title(dt);
}

export function titleStartup(): void {
  crawlerCommStartup({
    lobby_state: titleInit,
    title_func: (value: string) => 'Uncharted Wanders',
    chat_ui: main.chat_ui,
  });

  splash_text = spriteCreate({
    name: 'splash_text',
  });
  splash_logo = spriteCreate({
    name: 'splash_door',
  });
}
