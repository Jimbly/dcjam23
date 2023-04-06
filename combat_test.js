const { abs, floor, max, pow, random } = Math;

// return 0...1 weighted around 0.5
function bellish(xin, exp) {
  // also reasonable: return easeInOut(xin, 1/exp);
  xin = xin * 2 - 1; // -> -1..1
  let y = 1 - abs(pow(xin, exp)); // 0..1 weighted to 1
  if (xin < 0) {
    return y * 0.5;
  } else {
    return 1 - y * 0.5;
  }
}

function roundRand(v) {
  return floor(v + random());
}

function lerp(a, v0, v1) {
  return (1 - a) * v0 + a * v1;
}

function damageRaw(attacker_atk, defender_def) {
  let dam = attacker_atk * attacker_atk / (attacker_atk + defender_def);
  dam *= lerp(bellish(random(), 3), 0.5, 1.5);
  dam = roundRand(dam);
  dam = max(1, dam);
  return dam;
}

function damage(attacker, defender) {
  let attacker_atk = attacker.attack;
  let defender_def = defender.defense;
  return damageRaw(attacker_atk, defender_def);
}

const T = [[{
  portrait: 1,
  hp: 10, hp_max: 10,
  attack: 2, defense: 2,
  cost: 10,
  realm: 'phys',
}], [{
  portrait: 2,
  hp: 15, hp_max: 15,
  attack: 2, defense: 5,
  cost: 20,
  realm: 'phys',
}, {
  portrait: 10,
  hp: 10, hp_max: 10,
  attack: 5, defense: 1,
  cost: 20,
  realm: 'spirit',
}], [{
  portrait: 3,
  hp: 10, hp_max: 10,
  attack: 6, defense: 1,
  cost: 40,
  realm: 'phys',
}, {
  portrait: 11,
  hp: 12, hp_max: 12,
  attack: 3, defense: 15,
  cost: 40,
  realm: 'spirit',
}]];


let tier = 2;
let party_size = 6;

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function runTest(stats) {
  let party = [];
  for (let ii = 0; ii < party_size; ++ii) {
    let list = T[tier];
    party.push(clone(list[ii % list.length]));
  }
  let battles = 0;
  while (party.length && battles < 100) {
    stats.hp = stats.hp_max;
    while (stats.hp>0 && party.length) {
      for (let ii = 0; ii < party.length; ++ii) {
        let p = party[ii];
        stats.hp -= damage(p, stats);
      }
      if (stats.hp) {
        let t = floor(random() * party.length);
        let p = party[t];
        p.hp -= damage(stats, p);
        if (p.hp <= 0) {
          party.splice(t, 1);
        }
      }
    }
    if (stats.hp < 0) {
      ++battles;
    }
  }
  return battles;
}

for (let attack = 16; attack <= 16; ++attack) {
  for (let defense = 16; defense <= 16; ++defense) {
    if (attack !== defense && attack <= 3) {
      continue;
    }
    let best = 0;
    for (let hp = 30; hp < 100; hp+=2) {
      let b = 0;
      let stats = { attack, defense, hp_max: hp };
      for (let ii = 0; ii < 100; ++ii) {
        b += runTest(stats);
      }
      console.log(`T${tier+1}x${party_size} vs ${attack}/${defense}/${hp} > ${(b/100).toFixed(1)} battles`);
      if (b/100 >= 0.6) {
        best = hp;
      }
    }
    if (best) {
      console.log(`T${tier+1}x${party_size} vs ${attack}/${defense}/${best} > 2.5 battles`);
    }
  }
}
