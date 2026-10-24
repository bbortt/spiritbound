// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * The prologue sequence, one entry per beat.
 *
 * The verse is a copy: `docs/PROLOGUE.md` is the source of truth, and
 * `prologueBeats.test.ts` fails if a line here stops occurring in it. Plate
 * ids, shot sizes and the motif structure come from `docs/PROLOGUE_SHOTLIST.md`.
 *
 * Beats are flat rather than nested by chapter, so the renderer only has to
 * crossfade when `plate` changes — consecutive beats sharing a plate are two
 * stanzas on one image, and a null plate is a black card between them.
 */

/** Extreme wide, wide, medium, close-up — the sequence zooms in as it goes. */
export type Shot = 'XW' | 'W' | 'M' | 'CU';

export type Beat = {
  /** Plate id in `PROLOGUE_SHOTLIST.md`, or null for a black card. */
  plate: string | null;
  shot?: Shot;
  /** Empty for a plate that plays with no text. */
  lines: string[];
  voice: 'spoken' | 'sung' | 'other-hand';
  holdMs: number;
  /** Scroll factors for the far / mid / near planes. */
  parallax: readonly [number, number, number];
  /** "SPIRITBOUND" drops over this beat. */
  titleCard?: true;
};

export const PROLOGUE_BEATS: readonly Beat[] = [
  {
    plate: 'I.1',
    shot: 'XW',
    lines: [
      'In the beginning was nothing. And a voice.',
      'A will in the emptiness, heavy with choice.',
      'It spoke a word into the unmade dark,',
      'and out of that word there was kindled a spark.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'II.1',
    shot: 'XW',
    lines: [
      'At first they were small, and knew nothing at all,',
      'too new to be clever, too young to recall.',
      'But one became many, and many burned bright,',
      'and out of that burning came thought, and came sight.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'II.2',
    shot: 'W',
    lines: [
      'These weightless ones, wanting of shape and of form,',
      'unbound by a law, unbeholden to norm,',
      'went wandering out through the vast and unknown',
      'and danced amid stars in the dark, and alone.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'III.1',
    shot: 'W',
    lines: [
      'They learned how to think, and to think was to be free,',
      'to stretch past the reach of what any eye could see.',
      'They wove themselves worlds out of wanting and thought',
      'and believed in the wonders their believing had wrought.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'III.2',
    shot: 'M',
    lines: [
      'In those kingdoms they raised what no waking eye knew,',
      'and taught wings to the creatures they dreamed into view.',
      'Yet nothing they made could be held, or be kept,',
      'and into that wanting a hunger had crept.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'IV.1',
    shot: 'XW',
    lines: [
      'They asked, and the voice heard their asking, and gave',
      'the second of three to the wanting it made:',
      'for thought can imagine, and matter can keep,',
      "and magic's the bridge that is thrown 'cross the deep.",
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'IV.1',
    shot: 'XW',
    lines: [
      'And the thoughts knew their power then, learned how to wield,',
      'and all they had dreamt could be shaped and made real.',
      'They coloured the skies and they sculpted the ground,',
      'and the worlds they had wanted grew solid around.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'V.R',
    shot: 'W',
    lines: [
      "For thought, and for magic, and matter's own plane —",
      'these three are the layers, and these three remain.',
    ],
    voice: 'sung',
    holdMs: 6000,
    parallax: [0.2, 0.45, 0.8],
  },
  {
    plate: 'V.1',
    shot: 'M',
    lines: [
      'Then some of the thoughts, being restless, grew bold,',
      'and wanted a shape that their hands could take hold.',
      'They gathered up magic, they gathered up clay,',
      'and made themselves bodies, and stepped into day.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'VI.1',
    shot: 'W',
    lines: [
      'And each form was its own, and no two were the same,',
      'from the blur that stayed formless to the man with a name.',
      'Some took to the sky as great dragons of gold,',
      'some ran as the wolf runs, some grew and grew old.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'VI.2',
    shot: 'M',
    lines: [
      'But not all took a body. Some stayed as a light,',
      'with no hands for the world, and no weight, and no height.',
      'And so each of them carried the half of a whole:',
      'one could touch, and would end. One would last, with no hold.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'VII.1',
    shot: 'CU',
    lines: [
      "So the light came to rest in a mortal's cupped hand,",
      'and the two of them struck what no voice had yet planned:',
      'I will lend you my hands, and the world, and the day.',
      'You will hold what I am when the body gives way.',
    ],
    voice: 'spoken',
    holdMs: 9000,
    parallax: [0.05, 0.12, 0.25],
    titleCard: true,
  },
  {
    plate: 'VII.1',
    shot: 'CU',
    lines: [
      'For thought is the soul, and the soul is a flame',
      'that a body can carry but cannot contain.',
      'So the light would keep hold when the body was done,',
      'and give back to the next what it kept of the one.',
    ],
    voice: 'spoken',
    holdMs: 9000,
    parallax: [0.05, 0.12, 0.25],
  },
  {
    plate: 'VIII.1',
    shot: 'XW',
    lines: [
      'And the voice, when it saw what its whisper had grown,',
      'laughed once — and the laugh was a world of its own.',
      'From that laughter came stars, and the dark in between,',
      'and the deep, and the beasts, and the wide and the green.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'VIII.R',
    shot: 'W',
    lines: [
      'But it knew what is stacked can be tipped and can fall,',
      'so it gave them one law, and the one law was all:',
      'take only the measure that you can return.',
      'For the three hold each other, and each in its turn.',
    ],
    voice: 'spoken',
    holdMs: 9000,
    parallax: [0.2, 0.45, 0.8],
  },
  {
    plate: 'IX.1',
    shot: 'M',
    lines: [
      'And most of them heard it, and most of them kept.',
      'But some had a hunger that would not be met.',
      'They took, and they took, and gave nothing away,',
      'and they turned on each other. And that was the day.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'IX.2',
    shot: 'W',
    lines: [
      'The white towers, raised out of dreaming and thought,',
      'burned bright in the breaking, and came to be naught.',
      'They spent all their magic on ruin, and then',
      'had nothing to mend with, and nothing again.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'X.1',
    shot: 'W',
    lines: [
      'And the voice, that had laughed once, went quiet, and stayed.',
      "The bodies they'd worn withered off and were laid",
      'in the dust of the cities they no longer knew,',
      'and the shadows came in where the wonders once grew.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'X.2',
    shot: 'W',
    lines: [
      'First the voice went. And then the great magic went thin.',
      'And last — and the last was the worst of the three —',
      'they stopped asking at all. And they knelt in the dust',
      'and they looked up at the sky, and the sky was just sky.',
    ],
    voice: 'spoken',
    holdMs: 12000,
    parallax: [0, 0, 0],
  },
  {
    plate: 'XI.1',
    shot: 'W',
    lines: [
      'So they searched, having nothing, and searched themselves through,',
      'and they found in the searching the thing that was true:',
      'they forgave one another. They let the rest fall.',
      'And they built, without magic, and building was all.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'XI.2',
    shot: 'M',
    lines: [
      'And the green came back slowly. The skies became clear.',
      'They raised smaller cities and lived in them near',
      "to each other, and taught what they'd learned to their young,",
      'and the song of three layers came to be sung.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'XI.3',
    shot: 'CU',
    lines: [
      "And the lights, who'd lost nothing, kept faith all the same.",
      'They held what was handed. They gave back again.',
      'The voice had gone silent. The bond had not.',
      'And they kept the one law that the world had forgot.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'XII.1',
    shot: 'W',
    lines: [
      'And the years became many, and good ones, and long.',
      'Three peoples kept faith with the light, and their song',
      'is the one you are hearing. Their shrines are still warm.',
      'And the bound walk in sunlight, and keep us from harm.',
    ],
    voice: 'spoken',
    holdMs: 7000,
    parallax: [0.25, 0.55, 1],
  },
  {
    plate: 'XII.R',
    shot: 'W',
    lines: [
      "For thought, and for magic, and matter's own plane —",
      'these three are the layers, and these three remain.',
    ],
    voice: 'sung',
    holdMs: 6000,
    parallax: [0.2, 0.45, 0.8],
  },
  {
    plate: null,
    lines: [
      'Here the song ends, as it is sung.',
      'What follows is written in another hand.',
    ],
    voice: 'spoken',
    holdMs: 5000,
    parallax: [0, 0, 0],
  },
  {
    plate: 'XIII.1',
    shot: 'M',
    lines: [
      'But a thing that can hold is a thing that can keep.',
      'And a hunger, once learned, is not easily lost.',
      'The first time, the bodied took magic, and fell.',
      'This time it is not the bodied. And it is not magic.',
    ],
    voice: 'other-hand',
    holdMs: 7000,
    parallax: [0.05, 0.12, 0.25],
  },
  {
    plate: 'XIII.2',
    shot: 'CU',
    lines: [
      "For a light wants no magic. It knows what it's held.",
      'It has carried our souls, and it knows what they weigh.',
      'And it wondered — just once, and just quietly — how',
      'it would be to keep one. And to not give it back.',
    ],
    voice: 'other-hand',
    holdMs: 7000,
    parallax: [0.05, 0.12, 0.25],
  },
  {
    plate: 'XIV.R',
    shot: 'W',
    lines: [
      "For thought, and for magic, and matter's own plane —",
      'and for you, who have nothing. Begin again.',
    ],
    voice: 'sung',
    holdMs: 6000,
    parallax: [0.2, 0.45, 0.8],
  },
  {
    plate: 'XIV.1',
    shot: 'W',
    lines: [],
    voice: 'spoken',
    holdMs: 8000,
    parallax: [0.15, 0.35, 0.7],
  },
  {
    plate: 'XIV.2',
    shot: 'CU',
    lines: [],
    voice: 'spoken',
    holdMs: 6000,
    parallax: [0.05, 0.12, 0.25],
  },
];
