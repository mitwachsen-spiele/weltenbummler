// Klangsteine: wie die Note schwebt (ihr Bild und das des Steins: mitwachsen-stone-look.ts), und das Abspielen der
// Geschichte – erst die Melodie des Ortes, dann, sobald es sie gibt, die eingesprochene Aufnahme.
// Spezifikation: docs/specs/mitwachsen.md

import { STORIES, melodyLength, told, type StoryId } from '../../data/games/mitwachsen-stories';
import type { GateId } from '../../data/games/mitwachsen';
import type { Sfx } from './sfx';

/**
 * Hat das Kind gehört, was dieser Stein jetzt erzählt? Dieselbe Kennung wie die Regeln (`told`): Ist das Eistor offen,
 * zählt am Stein davor die zweite Fassung der Eis-Geschichte.
 */
export const heardStone = (s: { heard: readonly StoryId[]; openGates: readonly GateId[] }, id: StoryId) =>
  s.heard.includes(told(id, s.openGates));

/**
 * Wie die Note über ihrem Stein schwebt: Höhe über der Oberkante und Größe. Eine noch nie gehörte Geschichte ist
 * größer und pulsiert sanft (so sieht man ohne Text, wo es etwas Neues gibt); bei reduzierter Bewegung steht alles still.
 */
export function noteFloat(now: number, phase: number, heard: boolean, reduced: boolean): { z: number; scale: number } {
  if (reduced) return { z: 0.7, scale: heard ? 1 : 1.15 };
  const pulse = heard ? 0 : 0.08 + 0.08 * Math.sin(now / 280 + phase);
  return { z: 0.7 + Math.sin(now / 650 + phase) * 0.1, scale: 1 + pulse };
}

/**
 * Spielt die Geschichten der Klangsteine: Hineinlaufen startet, noch einmal Hineinlaufen hält an, ein anderer Stein
 * löst den vorigen ab. Erst die Melodie, danach die Aufnahme (wird erst jetzt geladen); ohne Aufnahme nur die Melodie.
 */
export class StoryPlayer {
  playing: StoryId | null = null;
  private stopMelody: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private voice: HTMLAudioElement | null = null;

  constructor(private readonly sfx: Sfx) {}

  toggle(id: StoryId) {
    const again = this.playing === id;
    this.stop();
    if (!again) this.start(id);
  }

  private start(id: StoryId) {
    const story = STORIES[id];
    this.playing = id;
    this.stopMelody = this.sfx.melody(story.melody);
    this.timer = setTimeout(
      () => {
        if (!story.voice || this.sfx.muted) return this.stop();
        const audio = new Audio(story.voice);
        this.voice = audio;
        audio.onended = audio.onerror = () => this.stop();
        audio.play().catch(() => this.stop());
      },
      melodyLength(story.melody) * 1000,
    );
  }

  stop() {
    clearTimeout(this.timer);
    this.stopMelody?.();
    this.stopMelody = null;
    this.voice?.pause();
    this.voice = null;
    this.playing = null;
  }
}
