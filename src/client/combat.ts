import assert from 'assert';
import { AnimationSequencer, animationSequencerCreate } from 'glov/client/animation';
import * as engine from 'glov/client/engine';
import {
  getFrameIndex,
  getFrameTimestamp,
} from 'glov/client/engine';
import { ALIGN } from 'glov/client/font';
import { Sprite, spriteCreate } from 'glov/client/sprites';
import * as ui from 'glov/client/ui';
import {
  modalDialog,
  playUISound,
} from 'glov/client/ui';
import {
  easeIn,
  easeOut,
  lerp,
  ridx,
} from 'glov/common/util';
import { Vec2, vec4 } from 'glov/common/vmath';
import { crawlerRenderViewportGet } from './crawler_render';
import { isEntityDrawableSprite } from './crawler_render_entities';
import {
  EntityDemoClient,
  StatsData,
  entityManager,
} from './entity_demo_client';
import {
  drawHealthBar,
  mercPos,
  myEnt,
  restartInTown,
} from './play';

const { abs, floor, max, pow, random } = Math;

type Entity = EntityDemoClient;

const ENEMY_ATTACK_TIME = 1000;
const ENEMY_ATTACK_TIME_R = 200;
const MERC_ATTACK_TIME = 1000;
const MERC_ATTACK_TIME_R = 200;
class CombatState {
  enemy_attack_counter = ENEMY_ATTACK_TIME + random() * ENEMY_ATTACK_TIME_R;
  anims: AnimationSequencer[] = [];
  did_death = false;
  did_victory = false;
  merc_timers: number[] = [];
  merc_timers2: number[] = [];
}

let combat_state: CombatState | null = null;

let damage_sprite: Sprite;

let temp_color = vec4(1, 1, 1, 1);


// return 0...1 weighted around 0.5
function bellish(xin: number, exp: number): number {
  // also reasonable: return easeInOut(xin, 1/exp);
  xin = xin * 2 - 1; // -> -1..1
  let y = 1 - abs(pow(xin, exp)); // 0..1 weighted to 1
  if (xin < 0) {
    return y * 0.5;
  } else {
    return 1 - y * 0.5;
  }
}

function roundRand(v: number): number {
  return floor(v + random());
}

function damageRaw(attacker_atk: number, defender_def: number): number {
  let dam = attacker_atk * attacker_atk / (attacker_atk + defender_def);
  dam *= lerp(bellish(random(), 3), 0.5, 1.5);
  dam = roundRand(dam);
  dam = max(1, dam);
  return dam;
}

function damage(attacker: StatsData, defender: StatsData): number {
  let attacker_atk = attacker.attack;
  let defender_def = defender.defense;
  return damageRaw(attacker_atk, defender_def);
}

// function cleanDeadMercs(): void {
//   assert(combat_state);
//   let me = myEnt();
//   let { mercs } = me.data;
//   for (let ii = mercs.length - 1; ii >= 0; --ii) {
//     let merc = mercs[ii];
//     if (merc.hp <= 0) {
//       mercs.splice(ii, 1);
//       combat_state.merc_timers.splice(ii, 1);
//       combat_state.merc_timers2.splice(ii, 1);
//     }
//   }
// }

function isAlive(thing: StatsData): boolean {
  return thing.hp > 0;
}

const ATTACK_WINDUP = 350;
const ATTACK_WINDDOWN = 250;

export function mercPosOverrideWeight(merc_index: number): number {
  if (!combat_state) {
    return 0;
  }
  let timer = combat_state.merc_timers[merc_index];
  if (timer < ATTACK_WINDUP) {
    let t = max(0, 1 - timer / ATTACK_WINDUP);
    return easeIn(t, 2);
  }
  timer = combat_state.merc_timers2[merc_index];
  if (timer) {
    let t = timer / ATTACK_WINDDOWN;
    return easeIn(t, 2);
  }
  return 0;
}

function cleanupMerc(index: number, dt: number): void {
  assert(combat_state);
  if (combat_state.merc_timers[index] < ATTACK_WINDUP) {
    combat_state.merc_timers[index] += dt;
  }
  combat_state.merc_timers2[index] = max(0, combat_state.merc_timers2[index] - dt);
}

export function cleanupCombat(dt: number): void {
  if (!combat_state) {
    return;
  }
  let me = myEnt();
  let { merc_capacity } = me.data;
  for (let ii = 0; ii < merc_capacity; ++ii) {
    cleanupMerc(ii, dt);
  }
}

const HEALTH_W = 100;
const HEALTH_H = 8;
let last_combat_frame = -1;
export function doCombat(target: Entity, dt: number, paused: boolean, flee_edge: boolean): void {
  let me = myEnt();
  let { mercs, merc_capacity } = me.data;
  let reset = last_combat_frame !== getFrameIndex() - 1;
  last_combat_frame = getFrameIndex();
  if (reset || !combat_state) {
    combat_state = new CombatState();
    for (let ii = 0; ii < merc_capacity; ++ii) {
      // mercs get chance for first hit
      combat_state.merc_timers[ii] = MERC_ATTACK_TIME * 0.5 + random() * (MERC_ATTACK_TIME * 0.5 + MERC_ATTACK_TIME_R);
      combat_state.merc_timers2[ii] = 0;
    }
  }

  let z = Z.UI;
  let stats = target.data.stats;
  let vp = crawlerRenderViewportGet();
  drawHealthBar(vp.x + (vp.w - HEALTH_W) / 2, vp.y + 20, z, HEALTH_W, HEALTH_H, stats.hp, stats.hp_max, false);

  if (paused) {
    dt = 0;
  } else {
    for (let ii = combat_state.anims.length - 1; ii >= 0; --ii) {
      if (!combat_state.anims[ii].update(dt)) {
        ridx(combat_state.anims, ii);
      }
    }
  }

  let alive_mercs = mercs.filter(isAlive);

  function drawDamageAt(pos: Vec2, dam: number, rise: boolean): void {
    if (rise) {
      pos[0] += (random() - 0.5) * 64;
    }
    let anim = animationSequencerCreate();
    anim.add(0, ENEMY_ATTACK_TIME, (progress) => {
      if (!combat_state) {
        return;
      }
      let alpha = easeOut(1 - progress, 4);
      temp_color[3] = alpha;
      let y = pos[1];
      if (rise) {
        y -= easeOut(progress, 2) * 64;
      }
      let rect = {
        x: pos[0] - 6,
        y: y - 6,
        w: 32,
        h: 32,
        z: Z.PARTICLES + combat_state.anims.indexOf(anim) * 0.1,
      };
      damage_sprite.draw({
        ...rect,
        color: temp_color,
      });
      ui.font.draw({
        ...rect,
        z: rect.z + 0.01,
        align: ALIGN.HVCENTER,
        text: `${dam}`,
        alpha,
      });
    });
    assert(combat_state);
    combat_state.anims.push(anim);
  }

  if (stats.hp > 0) {
    combat_state.enemy_attack_counter -= dt;
  }
  if (combat_state.enemy_attack_counter <= 0 && !combat_state.did_death) {
    if (!alive_mercs.length) {
      combat_state.did_death = true;
      playUISound('defeat');
      modalDialog({
        title: 'Defeat',
        text: 'With no mercenaries to defend you, the being quickly finishes you off.',
        button_width: 160,
        buttons: {
          'Restart from entrance': () => {
            restartInTown();
          },
        }
      });
    } else {
      combat_state.enemy_attack_counter += ENEMY_ATTACK_TIME + random() * ENEMY_ATTACK_TIME_R;

      let merc_target_idx = floor(random() * alive_mercs.length);
      let merg_target = alive_mercs[merc_target_idx];

      let dam = damage(stats, merg_target);
      if (engine.defines.INVINCIBLE) {
        dam = 0;
      }
      merg_target.hp = max(0, merg_target.hp - dam);

      if (isEntityDrawableSprite(target)) {
        target.drawable_sprite_state.grow_at = getFrameTimestamp();
        target.drawable_sprite_state.grow_time = 250;
      }
      let pos = mercPos(mercs.indexOf(merg_target));
      drawDamageAt(pos, dam, false);
    }
  }

  let do_merc_attacks = stats.hp > 0 && !combat_state.did_death && alive_mercs.length;
  for (let ii = 0; ii < merc_capacity; ++ii) {
    let merc = mercs[ii];
    if (merc && merc.hp > 0 && do_merc_attacks) {
      combat_state.merc_timers[ii] -= dt;
      combat_state.merc_timers2[ii] -= dt;
      if (combat_state.merc_timers2[ii] < 0) {
        combat_state.merc_timers2[ii] = 0;
      }
      if (combat_state.merc_timers[ii] <= 0) {
        combat_state.merc_timers[ii] += MERC_ATTACK_TIME + random() * MERC_ATTACK_TIME_R;
        combat_state.merc_timers2[ii] = ATTACK_WINDDOWN;
        let dam = damage(merc, stats);
        if (engine.defines.IMPOTENT) {
          dam = 0;
        }
        stats.hp = max(0, stats.hp - dam);
        drawDamageAt([vp.x + vp.w/2 - 8, vp.y + vp.h / 2], dam, true);
      }
    } else {
      cleanupMerc(ii, dt);
    }
  }

  if (stats.hp <= 0 && !combat_state.did_victory) {
    // victory!
    combat_state.did_victory = true;
    //cleanDeadMercs();
    playUISound('victory');
    entityManager().deleteEntity(target.id, 'killed');
  }


  if (flee_edge) {
    modalDialog({
      title: 'Flee?',
      text: 'Do you really wish to run away?  Your mercenaries will all stay, fight,' +
        ' and perish, allowing you to escape.',
      buttons: {
        yes: () => {
          stats.hp = 0;
          entityManager().deleteEntity(target.id, 'killed');
          me.data.mercs = [];
        },
        no: null,
      }
    });
  }
}

export function combatStartup(): void {
  damage_sprite = spriteCreate({
    name: 'particles/damage',
  });
}
