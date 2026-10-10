import { describe, expect, it } from 'vitest';

import { parseMediaFilename } from './filename-parser';

import type { ParsedMedia } from './filename-parser';

/** Fixed, so years like `2049` stay out of range whatever year the tests run in. */
const options = { maxYear: 2027 };

type Expected = [path: string, title: string | null, year?: number, extra?: Partial<ParsedMedia>];

/** Real-world names: scene releases, Plex/Jellyfin layouts, disc folders and generic names. */
const FIXTURES: readonly Expected[] = [
  // Scene and P2P movie releases
  ['Inception.2010.1080p.mkv', 'Inception', 2010],
  [
    'The.Dark.Knight.2008.2160p.UHD.BluRay.x265.10bit.HDR.DTS-HD.MA.5.1-SWTYBLZ.mkv',
    'The Dark Knight',
    2008,
  ],
  ['Interstellar.2014.IMAX.1080p.BluRay.x264.DTS-HD.MA.5.1-FGT.mkv', 'Interstellar', 2014],
  ['Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv', 'Dune Part Two', 2024],
  ['Oppenheimer.2023.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4', 'Oppenheimer', 2023],
  ['The.Matrix.1999.REMASTERED.1080p.BluRay.x264-AMIABLE.mkv', 'The Matrix', 1999],
  [
    'Blade.Runner.2049.2017.2160p.UHD.BluRay.REMUX.HDR.HEVC.Atmos-EPSiLON.mkv',
    'Blade Runner 2049',
    2017,
  ],
  ['Blade Runner 2049 (2017).mkv', 'Blade Runner 2049', 2017],
  ['2001.A.Space.Odyssey.1968.1080p.BluRay.x264.mkv', '2001 A Space Odyssey', 1968],
  ['2001 A Space Odyssey 1968.mkv', '2001 A Space Odyssey', 1968],
  ['1917.2019.1080p.BluRay.x264-SPARKS.mkv', '1917', 2019],
  ['2012.2009.720p.BluRay.x264.mkv', '2012', 2009],
  ['Spider-Man.No.Way.Home.2021.1080p.WEB-DL.DDP5.1.H.264-EVO.mkv', 'Spider-Man No Way Home', 2021],
  ['X-Men.Days.of.Future.Past.2014.Rogue.Cut.720p.BluRay.mkv', 'X-Men Days of Future Past', 2014],
  ['Mad_Max_Fury_Road_2015_1080p_BluRay.mp4', 'Mad Max Fury Road', 2015],
  ['the_godfather_1972_dvdrip_xvid.avi', 'the godfather', 1972],
  ['Pulp Fiction (1994) [1080p] [BluRay] [5.1] [YTS.MX].mp4', 'Pulp Fiction', 1994],
  ['[HorribleSubs] Spirited Away (2001) [1080p].mkv', 'Spirited Away', 2001],
  ['Alien.1979.Directors.Cut.1080p.BluRay.DTS.x264.mkv', 'Alien', 1979],
  ['Gladiator.2000.EXTENDED.REMASTERED.1080p.BluRay.x264.mkv', 'Gladiator', 2000],
  ['Joker.2019.HDR.2160p.WEB.H265-DEFLATE.mkv', 'Joker', 2019],
  ['Parasite.2019.KOREAN.1080p.BluRay.x264.DTS-FGT.mkv', 'Parasite', 2019],
  ['Amelie.2001.FRENCH.720p.BluRay.x264.mkv', 'Amelie', 2001],
  ['Top.Gun.Maverick.2022.1080p.AMZN.WEB-DL.DDP5.1.H.264.mkv', 'Top Gun Maverick', 2022],
  [
    'The.Lord.of.the.Rings.The.Return.of.the.King.2003.EXTENDED.1080p.BluRay.x264.mkv',
    'The Lord of the Rings The Return of the King',
    2003,
  ],
  ['Back to the Future (1985) 1080p.mkv', 'Back to the Future', 1985],
  [
    'Star.Wars.Episode.IV.A.New.Hope.1977.1080p.BluRay.mkv',
    'Star Wars Episode IV A New Hope',
    1977,
  ],
  ['Se7en.1995.1080p.BluRay.x264.mkv', 'Se7en', 1995],
  ["Ocean's.Eleven.2001.720p.BluRay.mkv", "Ocean's Eleven", 2001],
  [
    'Mission.Impossible.Dead.Reckoning.Part.One.2023.2160p.WEB-DL.DV.HDR10+.DDP5.1.mkv',
    'Mission Impossible Dead Reckoning Part One',
    2023,
  ],
  ['www.Torrenting.com - Barbie.2023.1080p.WEBRip.mp4', 'Barbie', 2023],
  ['Inception (2010) - 1080p.mkv', 'Inception', 2010],
  ['Avatar.The.Way.of.Water.2022.1080p.mkv', 'Avatar The Way of Water', 2022],
  ['The Shawshank Redemption.mkv', 'The Shawshank Redemption'],
  ['Heat.mkv', 'Heat'],
  ['WALL-E.2008.1080p.BluRay.mkv', 'WALL-E', 2008],
  // Plex / Jellyfin folders
  ['E:\\Movies\\Inception (2010)\\Inception.mkv', 'Inception', 2010],
  ['/Volumes/Media/Movies/Arrival (2016)/Arrival (2016) - 2160p.mkv', 'Arrival', 2016],
  ['D:\\Movies\\Heat (1995)\\movie.mkv', 'Heat', 1995],
  ['D:\\Movies\\The Thing (1982)\\CD1.avi', 'The Thing', 1982],
  ['D:\\Movies\\Casablanca (1942)\\VIDEO_TS\\VTS_01_1.VOB', 'Casablanca', 1942],
  ['D:\\Discs\\Tenet (2020)\\BDMV\\STREAM\\00001.m2ts', 'Tenet', 2020],
  ['D:\\Movies\\Memento.2000.1080p.BluRay.x264-GROUP\\memento.mkv', 'memento', 2000],
  ['F:\\Films\\Amadeus 1984\\film.mp4', 'Amadeus', 1984],
  // TV episodes
  [
    'Breaking.Bad.S01E01.720p.BluRay.x264.mkv',
    'Breaking Bad',
    undefined,
    { kind: 'tv', season: 1, episode: 1 },
  ],
  [
    'Game.of.Thrones.S08E06.The.Iron.Throne.1080p.AMZN.WEB-DL.DDP5.1.H.264-GoT.mkv',
    'Game of Thrones',
    undefined,
    { season: 8, episode: 6 },
  ],
  ['The.Office.US.S02E01.720p.WEB-DL.mkv', 'The Office US', undefined, { season: 2, episode: 1 }],
  [
    'Doctor.Who.2005.S01E01.Rose.720p.mkv',
    'Doctor Who',
    2005,
    { kind: 'tv', season: 1, episode: 1 },
  ],
  [
    'Friends - 1x01 - The One Where Monica Gets a Roommate.avi',
    'Friends',
    undefined,
    { season: 1, episode: 1 },
  ],
  [
    'Severance S02E03 2160p ATVP WEB-DL DDP5.1 DV H.265.mkv',
    'Severance',
    undefined,
    { season: 2, episode: 3 },
  ],
  [
    'the.mandalorian.s03e08.1080p.web.h264-glhf.mkv',
    'the mandalorian',
    undefined,
    { season: 3, episode: 8 },
  ],
  ['Chernobyl.S01E01E02.1080p.mkv', 'Chernobyl', undefined, { season: 1, episode: 1 }],
  ['Sherlock Season 2 Episode 1.mkv', 'Sherlock', undefined, { season: 2, episode: 1 }],
  [
    'E:\\TV\\Severance (2022)\\Season 1\\Severance - S01E01 - Good News About Hell.mkv',
    'Severance',
    2022,
    { season: 1, episode: 1 },
  ],
  ['E:\\TV\\Fargo\\Season 3\\S03E04.mkv', 'Fargo', undefined, { season: 3, episode: 4 }],
  ['E:\\TV\\Dark\\Season 1\\Episode 5.mkv', 'Dark', undefined, { season: 1, episode: 5 }],
  ['E:\\TV\\The Wire\\S01\\The.Wire.S01E07.mkv', 'The Wire', undefined, { season: 1, episode: 7 }],
  [
    'House.of.the.Dragon.S02E01.2160p.MAX.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265.mkv',
    'House of the Dragon',
    undefined,
    { season: 2, episode: 1 },
  ],
  [
    'Stranger Things - S04E09 - Chapter Nine.mkv',
    'Stranger Things',
    undefined,
    { season: 4, episode: 9 },
  ],
  ['Shogun.2024.S01E01.1080p.mkv', 'Shogun', 2024, { season: 1, episode: 1 }],
];

describe('parseMediaFilename fixtures', () => {
  const results = FIXTURES.map(([path, title, year, extra]) => {
    const parsed = parseMediaFilename(path, options);
    const ok =
      parsed.title === title &&
      parsed.year === year &&
      Object.entries(extra ?? {}).every(
        ([key, value]) => parsed[key as keyof ParsedMedia] === value,
      );
    return { path, parsed, ok };
  });

  it('has at least 50 samples', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(50);
  });

  it('parses at least 90% to the expected title and year', () => {
    const misses = results.filter((result) => !result.ok);
    const rate = 1 - misses.length / results.length;
    expect(rate, JSON.stringify(misses, null, 2)).toBeGreaterThanOrEqual(0.9);
  });
});

describe('parseMediaFilename', () => {
  it('reads the quality tokens of a release name', () => {
    expect(
      parseMediaFilename(
        'Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv',
        options,
      ),
    ).toEqual({
      kind: 'movie',
      title: 'Dune Part Two',
      year: 2024,
      resolution: '2160p',
      hdr: 'Dolby Vision',
      source: 'WEB-DL',
      audioChannels: '5.1',
      fileFormat: 'MKV',
      confidence: 0.85,
    });
  });

  it('reads HDR, audio and source variants', () => {
    const parse = (name: string) => parseMediaFilename(name, options);
    expect(parse('Movie.2020.2160p.HDR10+.TrueHD.7.1.mkv')).toMatchObject({
      hdr: 'HDR10+',
      audioChannels: '7.1',
    });
    expect(parse('Movie.2020.1080p.BluRay.REMUX.AAC2.0.mkv')).toMatchObject({
      source: 'REMUX',
      audioChannels: '2.0',
    });
    expect(parse('Movie.2020.4K.DoVi.WEB-DL.mkv')).toMatchObject({
      resolution: '2160p',
      hdr: 'Dolby Vision',
    });
  });

  it('gives a TV episode its series and episode numbers', () => {
    expect(parseMediaFilename('Breaking.Bad.S01E01.720p.BluRay.x264.mkv', options)).toEqual({
      kind: 'tv',
      title: 'Breaking Bad',
      season: 1,
      episode: 1,
      resolution: '720p',
      source: 'BluRay',
      fileFormat: 'MKV',
      confidence: 0.75,
    });
  });

  it('takes disc formats from the folder structure', () => {
    expect(
      parseMediaFilename('D:\\Movies\\Casablanca (1942)\\VIDEO_TS\\VTS_01_1.VOB', options),
    ).toMatchObject({ title: 'Casablanca', year: 1942, fileFormat: 'VIDEO_TS' });
    expect(parseMediaFilename('/Movies/Heat (1995)/Heat.iso', options)).toMatchObject({
      fileFormat: 'ISO',
    });
  });

  it('never takes a title from a home folder or a mount point', () => {
    expect(parseMediaFilename('/Users/stefan/Movies/movie.mkv', options).title).toBeNull();
    expect(parseMediaFilename('C:\\Users\\stefan\\Videos\\movie.mkv', options).title).toBeNull();
    expect(parseMediaFilename('/Volumes/Media/movie.mkv', options).title).toBeNull();
    expect(parseMediaFilename('/Movies/Home/movie.mkv', options).title).toBe('Home');
    expect(parseMediaFilename('/home/stefan/Heat (1995)/movie.mkv', options)).toMatchObject({
      title: 'Heat',
      year: 1995,
    });
  });

  it('returns no title and no confidence for a name without one', () => {
    expect(parseMediaFilename('movie.mkv', options)).toEqual({
      kind: 'unknown',
      title: null,
      fileFormat: 'MKV',
      confidence: 0,
    });
  });
});
