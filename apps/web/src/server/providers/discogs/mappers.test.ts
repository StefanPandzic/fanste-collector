import { describe, expect, it } from 'vitest';

import { parseMusicExtra } from '@fanste/core';

import masterFixture from './__fixtures__/master-24047.json';
import releaseFixture from './__fixtures__/release-2607424.json';
import {
  artistCredit,
  artistName,
  barcodesOf,
  mapMaster,
  mapRelease,
  mapSearchResult,
  matrixOf,
  plainNotes,
  searchDetail,
} from './mappers';
import { discogsMasterSchema, discogsReleaseSchema } from './schemas';

import type { DiscogsSearchResult } from './schemas';

const coverThumb =
  'https://i.discogs.com/uKBZ4UD1ZLYLd8H4ZuEy2ticElp1MpwRfS9gw74wXZk/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/R-9269057.jpeg';

const abbeyRoadReissue: DiscogsSearchResult = {
  id: 9269057,
  type: 'release',
  title: 'The Beatles - Abbey Road',
  year: '2016',
  country: 'UK & Ireland',
  format: ['Vinyl', 'LP', 'Album', 'Reissue', 'Remastered'],
  formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album', 'Reissue', 'Remastered'] }],
  catno: 'PCS 7088',
  thumb: coverThumb,
  cover_image: '',
};

const abbeyRoad = discogsReleaseSchema.parse(releaseFixture);
const abbeyRoadMaster = discogsMasterSchema.parse(masterFixture);

describe('artistName', () => {
  it('drops the number Discogs adds to tell artists apart', () => {
    expect(artistName('Prince (2)')).toBe('Prince');
    expect(artistName('The Beatles')).toBe('The Beatles');
  });
});

describe('artistCredit', () => {
  it('joins the artists with their join words and commas', () => {
    expect(
      artistCredit([
        { name: 'Paul Simon', join: '&' },
        { name: 'Art Garfunkel (2)', join: '' },
      ]),
    ).toBe('Paul Simon & Art Garfunkel');
    expect(
      artistCredit([
        { name: 'David Crosby', join: ',' },
        { name: 'Stephen Stills', join: ',' },
        { name: 'Graham Nash', join: '' },
      ]),
    ).toBe('David Crosby, Stephen Stills, Graham Nash');
  });
});

describe('plainNotes', () => {
  it('removes Discogs markup from notes', () => {
    expect(
      plainNotes(
        'Recorded at [l=EMI Studios] by [a=The Beatles]. See [url=https://www.discogs.com/master/24047]the master[/url]. [b]Misprint[/b]',
      ),
    ).toBe('Recorded at EMI Studios by The Beatles. See the master. Misprint');
  });

  it('names credited artists of ID references and drops the other references', () => {
    expect(
      plainNotes('[a82730] recorded it, see [r2607424] and [a1].', [
        { id: 82730, name: 'The Beatles' },
      ]),
    ).toBe('The Beatles recorded it, see and .');
  });
});

describe('barcodesOf', () => {
  it('lists the barcodes once each', () => {
    expect(
      barcodesOf([
        { type: 'Barcode', value: '5 099745 042210' },
        { type: 'Barcode', value: '5 099745 042210' },
        { type: 'Matrix / Runout', value: 'YEX.749' },
      ]),
    ).toEqual(['5 099745 042210']);
  });
});

describe('matrixOf', () => {
  it('lists the matrix / runout codes with their descriptions', () => {
    expect(
      matrixOf([
        { type: 'Matrix / Runout', value: 'YEX.749', description: 'Side A label' },
        { type: 'Matrix / Runout', value: 'YEX 750-1' },
        { type: 'Barcode', value: '5 099745 042210' },
      ]),
    ).toEqual([{ value: 'YEX.749', description: 'Side A label' }, { value: 'YEX 750-1' }]);
  });
});

describe('searchDetail', () => {
  it('lists the formats, country and catalog number of a pressing', () => {
    expect(searchDetail(abbeyRoadReissue)).toBe(
      'Vinyl, LP, Album, Reissue · UK & Ireland · PCS 7088',
    );
    expect(
      searchDetail({
        id: 2607424,
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] }],
        country: 'UK',
        catno: 'none',
      }),
    ).toBe('2×Vinyl, LP, Album · UK');
  });
});

describe('mapSearchResult', () => {
  it('splits the artist from the title and keeps a Discogs thumbnail', () => {
    expect(mapSearchResult(abbeyRoadReissue)).toEqual({
      provider: 'discogs',
      externalId: 'release:9269057',
      category: 'music',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
      releaseYear: 2016,
      thumbnailUrl: coverThumb,
      detail: 'Vinyl, LP, Album, Reissue · UK & Ireland · PCS 7088',
    });
  });

  it('drops thumbnails that are not on the Discogs image host', () => {
    expect(
      mapSearchResult({
        ...abbeyRoadReissue,
        thumb: 'https://st.discogs.com/images/default-release.png',
      })?.thumbnailUrl,
    ).toBeUndefined();
  });
});

describe('mapRelease', () => {
  it('maps a pressing with its label, formats and tracklist', () => {
    const item = mapRelease(abbeyRoad);
    expect(item).toMatchObject({
      provider: 'discogs',
      externalId: 'release:2607424',
      category: 'music',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
      releaseYear: 1969,
      genres: ['Rock', 'Pop Rock'],
      creators: ['The Beatles'],
      sourceUrl: 'https://www.discogs.com/release/2607424',
    });
    expect(item?.thumbnailUrl).toContain('https://i.discogs.com/');

    const extra = parseMusicExtra(item?.extra);
    expect(extra).toMatchObject({
      discogsType: 'release',
      country: 'UK',
      labels: [{ name: 'Apple Records', catalogNumber: 'PCS 7088' }],
      catalogNumber: 'PCS 7088',
      formats: [
        {
          name: 'Vinyl',
          quantity: 1,
          descriptions: ['LP', 'Album', 'Misprint', 'Stereo'],
          text: 'Misaligned Apple',
        },
      ],
      masterId: 24047,
    });
    expect(extra?.tracklist?.[0]).toEqual({ position: 'A1', title: 'Come Together' });
    expect(extra?.matrix?.[0]).toEqual({ value: 'YEX.749', description: 'Side A label' });
    expect(extra?.barcodes).toBeUndefined();
  });
});

describe('mapMaster', () => {
  it('maps a master without labels or formats', () => {
    const item = mapMaster(abbeyRoadMaster);
    expect(item).toMatchObject({
      externalId: 'master:24047',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
      sourceUrl: 'https://www.discogs.com/master/24047',
    });
    const extra = parseMusicExtra(item?.extra);
    expect(extra?.discogsType).toBe('master');
    expect(extra).not.toHaveProperty('formats');
    expect(extra?.tracklist?.length).toBe(17);
  });
});
