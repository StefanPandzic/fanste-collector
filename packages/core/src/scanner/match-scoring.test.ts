import { describe, expect, it } from 'vitest';

import {
  classifyMatch,
  jaroWinkler,
  MATCH_THRESHOLDS,
  normalizeTitle,
  scoreCandidate,
  scoreCandidates,
  titleSimilarity,
} from './match-scoring';

import type { ScoringCandidate } from './match-scoring';
import type { MatchCandidate } from '../gateway/requests';

function movie(
  id: number,
  title: string,
  releaseYear: number,
  popularity = 10,
  originalTitle?: string,
): ScoringCandidate {
  return {
    item: { provider: 'tmdb', externalId: `movie:${id}`, category: 'movie', title, releaseYear },
    popularity,
    ...(originalTitle ? { originalTitle } : {}),
  };
}

const inception = movie(27205, 'Inception', 2010, 85);
const dune1984 = movie(841, 'Dune', 1984, 40);
const dune2021 = movie(438631, 'Dune', 2021, 60);

function candidate(confidence: number): MatchCandidate {
  return { item: inception.item, confidence };
}

type WellNamed = [title: string, year: number, correctId: string, candidates: ScoringCandidate[]];

/** Parsed file titles and TMDB-like results: the right film plus sequels, remakes and namesakes. */
const WELL_NAMED_MOVIES: readonly WellNamed[] = [
  [
    'Inception',
    2010,
    'movie:27205',
    [inception, movie(64956, 'Inception: The Cobol Job', 2010, 5)],
  ],
  [
    'The Dark Knight',
    2008,
    'movie:155',
    [
      movie(155, 'The Dark Knight', 2008, 120),
      movie(49026, 'The Dark Knight Rises', 2012, 90),
      movie(123025, 'Batman: The Dark Knight Returns, Part 1', 2012, 20),
    ],
  ],
  ['Dune', 2021, 'movie:438631', [dune2021, dune1984, movie(693134, 'Dune: Part Two', 2024, 200)]],
  [
    'Blade Runner 2049',
    2017,
    'movie:335984',
    [movie(78, 'Blade Runner', 1982, 70), movie(335984, 'Blade Runner 2049', 2017, 80)],
  ],
  [
    'The Matrix',
    1999,
    'movie:603',
    [
      movie(603, 'The Matrix', 1999, 90),
      movie(604, 'The Matrix Reloaded', 2003, 50),
      movie(624860, 'The Matrix Resurrections', 2021, 60),
    ],
  ],
  [
    'Alien',
    1979,
    'movie:348',
    [
      movie(348, 'Alien', 1979, 70),
      movie(679, 'Aliens', 1986, 60),
      movie(945961, 'Alien: Romulus', 2024, 150),
    ],
  ],
  [
    'Spider-Man No Way Home',
    2021,
    'movie:634649',
    [
      movie(634649, 'Spider-Man: No Way Home', 2021, 180),
      movie(429617, 'Spider-Man: Far From Home', 2019, 90),
      movie(557, 'Spider-Man', 2002, 70),
    ],
  ],
  [
    'Top Gun Maverick',
    2022,
    'movie:361743',
    [movie(361743, 'Top Gun: Maverick', 2022, 110), movie(744, 'Top Gun', 1986, 60)],
  ],
  [
    'Mad Max Fury Road',
    2015,
    'movie:76341',
    [movie(76341, 'Mad Max: Fury Road', 2015, 80), movie(9659, 'Mad Max', 1979, 30)],
  ],
  [
    'Gladiator',
    2000,
    'movie:98',
    [movie(98, 'Gladiator', 2000, 90), movie(558449, 'Gladiator II', 2024, 300)],
  ],
  [
    'The Godfather',
    1972,
    'movie:238',
    [movie(238, 'The Godfather', 1972, 100), movie(240, 'The Godfather Part II', 1974, 60)],
  ],
  ['Pulp Fiction', 1994, 'movie:680', [movie(680, 'Pulp Fiction', 1994, 70)]],
  ['Spirited Away', 2001, 'movie:129', [movie(129, 'Spirited Away', 2001, 90, '千と千尋の神隠し')]],
  [
    'Joker',
    2019,
    'movie:475557',
    [movie(475557, 'Joker', 2019, 100), movie(889737, 'Joker: Folie à Deux', 2024, 120)],
  ],
  [
    'Parasite',
    2019,
    'movie:496243',
    [movie(496243, 'Parasite', 2019, 80, '기생충'), movie(27813, 'Parasite', 1982, 5)],
  ],
  ['Oppenheimer', 2023, 'movie:872585', [movie(872585, 'Oppenheimer', 2023, 150)]],
  [
    "Ocean's Eleven",
    2001,
    'movie:161',
    [movie(161, "Ocean's Eleven", 2001, 60), movie(299, "Ocean's Eleven", 1960, 15)],
  ],
  [
    'Back to the Future',
    1985,
    'movie:105',
    [
      movie(105, 'Back to the Future', 1985, 80),
      movie(165, 'Back to the Future Part II', 1989, 50),
    ],
  ],
  ['Interstellar', 2014, 'movie:157336', [movie(157336, 'Interstellar', 2014, 140)]],
  [
    'Star Wars Episode IV A New Hope',
    1977,
    'movie:11',
    [movie(11, 'Star Wars', 1977, 90), movie(1891, 'The Empire Strikes Back', 1980, 60)],
  ],
  [
    'Amelie',
    2001,
    'movie:194',
    [movie(194, 'Amélie', 2001, 40, "Le Fabuleux Destin d'Amélie Poulain")],
  ],
  ['Se7en', 1995, 'movie:807', [movie(807, 'Se7en', 1995, 70)]],
];

describe('normalizeTitle', () => {
  it('drops case, accents, punctuation and a leading article', () => {
    expect(normalizeTitle('The Matrix')).toBe('matrix');
    expect(normalizeTitle('Amélie')).toBe('amelie');
    expect(normalizeTitle("Ocean's Eleven")).toBe('oceans eleven');
    expect(normalizeTitle('Spider-Man: No Way Home')).toBe('spider man no way home');
  });

  it('writes sequel numerals as digits and & as and', () => {
    expect(normalizeTitle('Rocky II')).toBe('rocky 2');
    expect(normalizeTitle('Fast & Furious')).toBe('fast and furious');
  });
});

describe('jaroWinkler', () => {
  it('scores equal, similar and unrelated strings', () => {
    expect(jaroWinkler('inception', 'inception')).toBe(1);
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('dune', 'heat')).toBeLessThan(0.5);
  });
});

describe('titleSimilarity', () => {
  it('is 1 for titles that differ only in punctuation or articles', () => {
    expect(titleSimilarity('Spider-Man No Way Home', 'Spider-Man: No Way Home')).toBe(1);
    expect(titleSimilarity('Matrix', 'The Matrix')).toBe(1);
  });

  it('keeps titles with close characters but other words apart', () => {
    expect(titleSimilarity('Alien', 'Aliens')).toBeLessThan(0.5);
  });
});

describe('scoreCandidate', () => {
  it('combines the title and the year', () => {
    expect(scoreCandidate({ title: 'Inception', year: 2010, kind: 'movie' }, inception)).toBe(1);
    expect(scoreCandidate({ title: 'Inception', year: 2011, kind: 'movie' }, inception)).toBe(0.94);
    expect(scoreCandidate({ title: 'Dune', year: 2021, kind: 'movie' }, dune1984)).toBe(0.7);
  });

  it('matches on the original title', () => {
    expect(
      scoreCandidate(
        { title: "Le Fabuleux Destin d'Amelie Poulain", year: 2001, kind: 'movie' },
        movie(194, 'Amélie', 2001, 40, "Le Fabuleux Destin d'Amélie Poulain"),
      ),
    ).toBe(1);
  });
});

describe('scoreCandidates', () => {
  it('ranks the candidates and drops the ones below review', () => {
    const scored = scoreCandidates({ title: 'Dune', year: 2021, kind: 'movie' }, [
      dune1984,
      movie(9799, 'The Fast and the Furious', 2001, 50),
      dune2021,
    ]);
    expect(scored).toEqual([
      { item: dune2021.item, confidence: 1 },
      { item: dune1984.item, confidence: 0.7 },
    ]);
  });

  it('holds a close tie below auto-add unless one title is much more popular', () => {
    const query = { title: 'Dune', kind: 'movie' } as const;
    const tied = scoreCandidates(query, [dune1984, dune2021]);
    expect(tied.map((entry) => entry.item.externalId)).toEqual(['movie:438631', 'movie:841']);
    expect(tied[0]?.confidence).toBeLessThan(MATCH_THRESHOLDS.autoAdd);

    const popular = scoreCandidates(query, [dune1984, { ...dune2021, popularity: 120 }]);
    expect(popular[0]?.item.externalId).toBe('movie:438631');
    expect(popular[0]?.confidence).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.autoAdd);
  });
});

describe('classifyMatch', () => {
  it('classifies the best candidate as matched, review or none', () => {
    expect(classifyMatch([candidate(0.95), candidate(0.7)])).toBe('matched');
    expect(classifyMatch([candidate(0.7)])).toBe('review');
    expect(classifyMatch([])).toBe('none');
  });

  it('sends confident matches to review when auto-add is off', () => {
    expect(classifyMatch([candidate(0.95)], { autoAdd: false })).toBe('review');
  });

  it('auto-adds at least 90% of well-named movies correctly', () => {
    const misses = WELL_NAMED_MOVIES.filter(([title, year, correctId, candidates]) => {
      const scored = scoreCandidates({ title, year, kind: 'movie' }, candidates);
      return classifyMatch(scored) !== 'matched' || scored[0]?.item.externalId !== correctId;
    });
    expect(WELL_NAMED_MOVIES.length).toBeGreaterThanOrEqual(20);
    expect(
      1 - misses.length / WELL_NAMED_MOVIES.length,
      JSON.stringify(misses.map(([title]) => title)),
    ).toBeGreaterThanOrEqual(0.9);
  });
});
