import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPECIES } from '../../data/games/mitwachsen';
import { ICE_MODELS } from '../../data/games/worlds/eis/mitwachsen-ice-models';
import { ICE_FINE_MODELS } from '../../data/games/worlds/eis/mitwachsen-ice-fine';
import { BAT_ROOST, CAVE_MODELS } from '../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { PACK_IDS, PACK_WAIT_MS, Packs, RETRY_MS, type LoadedPack } from './mitwachsen-packs';
import type { Need } from './mitwachsen-pack';
import { HINT_AFTER } from './mitwachsen-guide';
import { plateMid } from './mitwachsen-plate';
import { initialState, type State } from './mitwachsen-state';
import { gatePlaces } from './mitwachsen-world';
import { plateHint } from './worlds/eis/mitwachsen-plate-hint';
import { EIS_PACK, worldOf } from './test-worlds';

const gates = gatePlaces(1);
const bed: Need = { openGates: [], garden: [], at: [[0, 0]] }; // Tor zu, Figur am Bett: kein Bedarf
const open: Need = { ...bed, openGates: ['eis'] };
const pack = EIS_PACK as LoadedPack;

describe('Welt-Pakete laden (Packs)', () => {
  it('lädt nur bei Bedarf, einmal, und meldet die Ankunft', async () => {
    let loads = 0;
    const arrived: string[] = [];
    const packs = new Packs(
      (p) => arrived.push(p.id),
      () => (loads++, Promise.resolve(pack)),
      ['eis'],
    );
    await packs.want(bed, gates);
    expect(loads).toBe(0);
    expect(packs.loaded).toEqual([]);
    await Promise.all([packs.want(open, gates), packs.want(open, gates)]);
    expect(loads).toBe(1);
    expect(arrived).toEqual(['eis']);
    expect(packs.get('eis')).toBe(pack);
    await packs.want(open, gates); // schon da: nichts mehr
    expect(loads).toBe(1);
  });

  it('scheitert das Laden, geht es ohne weiter und versucht es frühestens nach RETRY_MS wieder', async () => {
    let loads = 0;
    const packs = new Packs(
      () => {},
      () => (++loads === 1 ? Promise.reject(new Error('Netz')) : Promise.resolve(pack)),
      ['eis'],
    );
    await packs.want(open, gates);
    expect(packs.loaded).toEqual([]);
    await packs.want(open, gates, performance.now() + 10);
    expect(loads).toBe(1);
    await packs.want(open, gates, performance.now() + RETRY_MS + 10);
    expect(loads).toBe(2);
    expect(packs.get('eis')).toBe(pack);
  });

  it('der Start wartet höchstens kurz (wait)', async () => {
    const packs = new Packs(
      () => {},
      () => new Promise<LoadedPack>(() => {}), // Netz hängt
    );
    const t = performance.now();
    await packs.wait(open, gates, 30);
    expect(performance.now() - t).toBeLessThan(1000);
    expect(packs.loaded).toEqual([]);
  });

  describe('wait mit Uhr unter Kontrolle', () => {
    afterEach(() => vi.useRealTimers());
    const hangs = () =>
      new Packs(
        () => {},
        () => new Promise<LoadedPack>(() => {}),
      ); // Netz hängt
    /** Erfüllt `wait` nach `ms` Millisekunden? */
    async function doneAfter(packs: Packs, ms: number) {
      let done = false;
      void packs.wait(open, gates).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(ms);
      return done;
    }

    it('innerhalb von waitMs wartet der Start noch', async () => {
      vi.useFakeTimers();
      const packs = hangs();
      expect(packs.waitMs).toBe(PACK_WAIT_MS);
      expect(await doneAfter(packs, PACK_WAIT_MS - 1)).toBe(false);
    });

    it('nach waitMs geht es ohne das Paket los', async () => {
      vi.useFakeTimers();
      const packs = hangs();
      expect(await doneAfter(packs, PACK_WAIT_MS)).toBe(true);
      expect(packs.loaded).toEqual([]);
    });

    it('ein geändertes waitMs gilt (der Browser-Test setzt es hoch, die Pipeline ist langsam)', async () => {
      vi.useFakeTimers();
      const packs = hangs();
      packs.waitMs = 60_000;
      expect(await doneAfter(packs, PACK_WAIT_MS + 1)).toBe(false);
      packs.waitMs = 10;
      expect(await doneAfter(packs, 10)).toBe(true);
    });
  });

  it('ohne eigenen Lader kommt das echte Paket der Eis-Welt (import())', async () => {
    const packs = new Packs(() => {});
    await packs.want(open, gates);
    expect(packs.get('eis')?.id).toBe('eis');
    expect(typeof packs.get('eis')?.view?.decos.igloo).toBe('function');
  });

  it('mit dem Paket kommen die Modelle der Eis-Tiere (der Kern kennt sie nicht), fein und mit ihrer Grundform', async () => {
    const robbe = SPECIES.robbe.parts;
    SPECIES.robbe.parts = [];
    const packs = new Packs(
      () => {
        expect(SPECIES.robbe.parts).toBe(ICE_FINE_MODELS.robbe); // schon eingetragen, wenn es ankommt
        expect(SPECIES.robbe.outline).toBe(ICE_MODELS.robbe); // Umriss von „Noch nicht“ aus der Grundform
      },
      () => Promise.resolve(pack),
    );
    await packs.want(open, gates);
    expect(SPECIES.robbe.parts.length).toBeGreaterThan(0);
    SPECIES.robbe.parts = robbe;
  });

  it('je Paket ein Lader (Eis-Welt, Höhlenwelt, Bahn, Fahrzeuge, Grubenbahn); jedes Paket lädt für sich, nur wenn sein Tor es braucht', async () => {
    expect(PACK_IDS).toEqual(['eis', 'hoehle', 'bahn', 'fahrt', 'grube']);
    const asked: string[] = [];
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle' } as LoadedPack;
    const packs = new Packs(
      () => {},
      (id) => (asked.push(id), Promise.resolve(id === 'eis' ? pack : hoehle)),
      ['eis', 'hoehle'],
    );
    await packs.want(open, gates); // das Eistor ist offen: nur das Paket der Eis-Welt
    expect(asked).toEqual(['eis']);
    expect(packs.at('eis')).toBe(pack);
    expect(packs.at('hoehle')).toBeUndefined();
    const door = gates.get('hoehle')!;
    await packs.want({ ...bed, at: [door.mid] }, gates); // nah am Höhlentor vor der Eis-Welt: Tok kommt erst danach
    expect(asked).toEqual(['eis']);
    await packs.want({ ...open, at: [door.mid] }, gates); // nah am Höhlentor nach der Eis-Welt: jetzt auch die Höhlenwelt
    expect(asked).toEqual(['eis', 'hoehle']);
    await packs.want({ ...bed, openGates: ['hoehle'] }, gates); // das Höhlentor ist offen: sie ist schon da
    expect(asked).toEqual(['eis', 'hoehle']);
    expect(packs.at('hoehle')).toBe(hoehle);
    expect(packs.get('hoehle')).toBe(hoehle);
  });

  it('das Paket der Bahn kommt, sobald das Eistor offen ist, vorher nur mit dem Entwickler-Schalter', async () => {
    const asked: string[] = [];
    const bahn = { id: 'bahn' } as LoadedPack;
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle' } as LoadedPack;
    const packs = new Packs(
      () => {},
      (id) => (
        asked.push(id),
        Promise.resolve(
          { eis: pack, hoehle, bahn, fahrt: { id: 'fahrt' } as LoadedPack, grube: { id: 'grube' } as LoadedPack }[id],
        )
      ),
    );
    await packs.want(bed, gates); // Eistor zu: keine Bahn
    expect(asked).not.toContain('bahn');
    await packs.want({ ...open, openGates: ['eis', 'hoehle'] }, gates);
    expect(asked).toContain('bahn');
    expect(packs.get('bahn')).toBe(bahn);
    expect(packs.at(undefined)).toBeUndefined(); // ein Paket ohne Tor ist nie „das Paket hinter einem Tor“
    expect(packs.at('hoehle')).toBe(hoehle); // das Paket hinter dem Höhlentor bleibt die Höhlenwelt
    asked.length = 0;
    const dev = new Packs(
      () => {},
      (id) => (
        asked.push(id),
        Promise.resolve(
          { eis: pack, hoehle, bahn, fahrt: { id: 'fahrt' } as LoadedPack, grube: { id: 'grube' } as LoadedPack }[id],
        )
      ),
    );
    dev.extra = ['bahn']; // der Entwickler-Schalter holt es auch ohne Bedarf
    await dev.want(bed, gates);
    expect(asked).toEqual(['bahn']);
  });

  it('das Paket der Fahrzeuge kommt, sobald es ein Fahrzeug geben kann (Eistor offen), mit dem Schalter der Bahn auch so', async () => {
    const asked: string[] = [];
    const fahrt = { id: 'fahrt' } as LoadedPack;
    const make = () =>
      new Packs(
        () => {},
        (id) => (asked.push(id), Promise.resolve(id === 'fahrt' ? fahrt : pack)),
        ['eis', 'fahrt'],
      );
    await make().want(bed, gates); // Tor zu: kein Fahrzeug, keine Fahr-Engine
    expect(asked).toEqual([]);
    const packs = make();
    await packs.want(open, gates); // Eistor offen: der Schlitten kann kommen
    expect(asked.sort()).toEqual(['eis', 'fahrt']);
    expect(packs.get('fahrt')).toBe(fahrt);
    expect(packs.at('eis')).toBe(pack); // die Fahr-Engine ist kein Paket hinter einem Tor
    asked.length = 0;
    const dev = make();
    dev.extra = ['fahrt']; // der Entwickler-Schalter der Bahn bringt sie mit (mitwachsen-dev.ts)
    await dev.want(bed, gates);
    expect(asked).toEqual(['fahrt']);
  });

  it('das Paket der Grubenbahn kommt immer mit der Grotte: an ihrem Tor, vor einem Halt, mit dem Schalter', async () => {
    const asked: string[] = [];
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle' } as LoadedPack;
    const grube = { id: 'grube' } as LoadedPack;
    const make = () =>
      new Packs(
        () => {},
        (id) => (asked.push(id), Promise.resolve({ eis: pack, hoehle, grube }[id as 'eis'])),
        ['eis', 'hoehle', 'grube'],
      );
    await make().want(open, gates); // nur das Eistor offen: weder Grotte noch Grubenbahn
    expect(asked).toEqual(['eis']);
    asked.length = 0;
    const packs = make();
    await packs.want({ ...bed, openGates: ['hoehle'] }, gates); // das Höhlentor ist offen: beide
    expect(asked).toEqual(['hoehle', 'grube']);
    expect(packs.at('hoehle')).toBe(hoehle); // hinter dem Höhlentor bleibt die Grotte
    expect(packs.get('grube')).toBe(grube);
    asked.length = 0;
    await make().want({ ...bed, ride: ['hoehle'] }, gates); // Vorladen am Halt des Zugs holt die Grotte: beide
    expect(asked).toEqual(['hoehle', 'grube']);
    asked.length = 0;
    const dev = make();
    dev.extra = ['hoehle']; // ?entwickler=hoehle: die Grubenbahn kommt mit
    await dev.want(bed, gates);
    expect(asked).toEqual(['hoehle', 'grube']);
  });

  it('ohne eigenen Lader kommt das echte Paket der Fahrzeuge (import()): nur Regeln, die Fahr-Engine', async () => {
    const packs = new Packs(() => {});
    await packs.want(open, gates);
    const fahrt = packs.get('fahrt');
    expect(fahrt?.gate).toBeUndefined();
    expect(fahrt && 'build' in fahrt).toBe(false);
    expect(typeof fahrt?.rules?.ride).toBe('function');
  });

  it('scheitert ein Paket, lädt das andere trotzdem (still wie ein Netzfehler)', async () => {
    const load = (id: string) => (id === 'eis' ? Promise.resolve(pack) : Promise.reject(new Error('Netz')));
    const packs = new Packs(() => {}, load, ['hoehle', 'eis']);
    await packs.want({ ...open, openGates: ['eis', 'hoehle'] }, gates);
    expect(packs.loaded.map((p) => p.id)).toEqual(['eis']);
  });

  it('Entwickler-Schalter: `extra` holt ein Paket auch ohne Bedarf (das Höhlentor bleibt zu)', async () => {
    const asked: string[] = [];
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle' } as LoadedPack;
    const packs = new Packs(
      () => {},
      (id) => (asked.push(id), Promise.resolve(id === 'eis' ? pack : hoehle)),
      ['eis', 'hoehle'],
    );
    await packs.want(bed, gates);
    expect(asked).toEqual([]);
    packs.extra = ['hoehle'];
    await packs.want(bed, gates);
    expect(asked).toEqual(['hoehle']);
    expect(bed.openGates).not.toContain('hoehle');
  });

  it('Vorladen am Halt: `need.ride` holt die Pakete, die ein Fahrzeug braucht, auch ohne Bedarf am Tor (das Höhlentor bleibt zu)', async () => {
    const asked: string[] = [];
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle' } as LoadedPack;
    const packs = new Packs(
      () => {},
      (id) => (asked.push(id), Promise.resolve(id === 'eis' ? pack : hoehle)),
      ['eis', 'hoehle'],
    );
    await packs.want({ ...bed, ride: [] }, gates);
    expect(asked).toEqual([]);
    await packs.want({ ...bed, ride: ['hoehle'] }, gates);
    expect(asked).toEqual(['hoehle']);
    expect(packs.get('hoehle')).toBe(hoehle);
  });

  it('der echte Lader der Höhlenwelt bringt ihr Paket (Tor, Bau, Zeichenteile, 3D-Teil auf Abruf)', async () => {
    const packs = new Packs(() => {});
    packs.extra = ['hoehle'];
    await packs.want(bed, gates);
    const cave = packs.get('hoehle')!;
    expect(cave.gate).toBe('hoehle');
    expect(typeof cave.view3d).toBe('function');
    expect((await cave.view3d!()).gate).toBe('hoehle');
  });

  it('mit der Höhlenwelt kommen die Modelle ihrer Tiere und die Fledermaus kopfüber (Ruhehaltung)', async () => {
    const { parts, roost } = SPECIES.fledermaus;
    SPECIES.fledermaus.parts = [];
    SPECIES.fledermaus.roost = [];
    const packs = new Packs(() => {}, undefined, ['hoehle']);
    packs.extra = ['hoehle'];
    await packs.want(bed, gates);
    try {
      expect(SPECIES.fledermaus.parts).toBe(CAVE_MODELS.fledermaus);
      expect(SPECIES.fledermaus.roost).toBe(BAT_ROOST);
    } finally {
      SPECIES.fledermaus.parts = parts;
      SPECIES.fledermaus.roost = roost;
    }
  });

  it('test-worlds.ts trägt beim Import die Modelle aller Eis-Tiere ein (Tests sehen sie nur über diesen Helfer)', () => {
    const ids = Object.keys(ICE_MODELS) as (keyof typeof ICE_MODELS)[];
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      expect(SPECIES[id].parts, id).toBe(ICE_FINE_MODELS[id]);
      expect(SPECIES[id].outline, id).toBe(ICE_MODELS[id]);
      expect(SPECIES[id].parts.length, id).toBeGreaterThan(0);
    }
  });
});

describe('„Noch nicht“ über die Pakete (Packs.hint)', () => {
  const w = worldOf(1);
  const [x, y] = plateMid(w.gates.get('eis')!);
  const base = initialState(w, {});
  /** Wache Figur ohne Tiere auf (px, py), Takt `tick`, steht seit `still` Takten */
  const at = (tick: number, still: number, [px, py] = [x, y]): State => ({
    ...base,
    sleeping: false,
    animals: [],
    player: { x: px, y: py, dir: 'n' },
    tick,
    still,
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  /** Spielseite mit einem Eis-Paket, dessen Haken frisch ist (der des echten Pakets merkt sich, was er zeigte) */
  async function setup() {
    vi.useFakeTimers();
    vi.stubGlobal('document', { querySelector: () => ({ textContent: '' }) }); // Live-Region des Spiels
    let peeks = 0;
    const own = { ...pack, view: { ...pack.view, hint: plateHint() } } as LoadedPack;
    const packs = new Packs(
      () => {},
      () => Promise.resolve(own),
    );
    await packs.want(open, gates);
    const sfx = { score: () => {} };
    const ask = (s: State, now: number) => packs.hint(s, w, now, false, sfx, () => peeks++, null);
    return { packs, ask, peeks: () => peeks };
  }

  it('ohne Paket: nichts', () => {
    expect(new Packs(() => {}).hint(at(1, 0), w, 0, false, { score: () => {} }, () => {}, null)).toBeNull();
  });

  it('jeder geladene Haken wird je Bild gefragt, auch neben jeder Platte (er prüft seine Platte selbst)', async () => {
    const asked: string[] = [];
    const ask = (id: string, h: object) => () => (asked.push(id), h);
    const eis = { ...pack, view: { ...pack.view, hint: ask('eis', {}) } } as LoadedPack;
    const hoehle = { ...pack, id: 'hoehle', gate: 'hoehle', view: { hint: ask('hoehle', { id: 'hoehle' }) } };
    const packs = new Packs(
      () => {},
      (id) => Promise.resolve(id === 'eis' ? eis : (hoehle as unknown as LoadedPack)),
      ['eis', 'hoehle'],
    );
    await packs.want({ ...open, openGates: ['eis', 'hoehle'] }, gates);
    const off = at(5, 0, [x + 9, y + 9]);
    expect(packs.hint(off, w, 0, false, { score: () => {} }, () => {}, null)).toEqual({ id: 'hoehle' });
    expect(asked).toEqual(['eis', 'hoehle']); // beide gefragt; was ein Tor zeigt, gewinnt
  });

  it('verlässt die Figur die Platte, während das Eistor zeigt, was fehlt, vergeht es von selbst (es bleibt im Bild)', async () => {
    const { ask } = await setup();
    ask(at(100, 0), 1000); // betreten: Das Bild wird geholt
    await vi.dynamicImportSettled();
    const shown = ask(at(100 + HINT_AFTER, HINT_AFTER), 2000);
    expect(shown).toMatchObject({ id: 'eis', at: 2000 });
    const off = ask(at(101 + HINT_AFTER, 0, [x + 9, y + 9]), 2100); // gleich weg von der Platte
    expect(off).toBe(shown); // Umriss und Wackeln laufen weiter bis HINT_MS
  });

  it('was neben der Platte noch ausstand, verfällt: Zurück auf der Platte wartet es wieder die Sekunde', async () => {
    const { ask, peeks } = await setup();
    expect(ask(at(300, HINT_AFTER), 1000)?.at).toBeUndefined(); // fällig, das Bild ist noch unterwegs
    ask(at(301, 0, [x + 9, y + 9]), 1100); // weg von der Platte, bevor es kam
    await vi.dynamicImportSettled();
    expect(ask(at(302, 0), 1200)?.at).toBeUndefined(); // zurück: nicht sofort
    expect(peeks()).toBe(0);
  });
});
