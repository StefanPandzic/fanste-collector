import { describe, expect, it } from 'vitest';

import { isOwnAvatarPath, newAvatarPath } from './avatar-path';

const userId = '3f2b8c1e-6d4a-4b9e-9a51-2c7d8e0f1a23';
const otherUserId = '9a1c4e2b-7f3d-4c8a-b6e5-1d2f3a4b5c6d';

describe('newAvatarPath', () => {
  it('creates a unique path in the user folder with the file extension', () => {
    const path = newAvatarPath(userId, 'image/jpeg');
    expect(path).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.jpg$`));
    expect(newAvatarPath(userId, 'image/jpeg')).not.toBe(path);
  });
});

describe('isOwnAvatarPath', () => {
  it('accepts paths made for the user', () => {
    expect(isOwnAvatarPath(newAvatarPath(userId, 'image/png'), userId)).toBe(true);
  });

  it('rejects paths of other users and other files', () => {
    expect(isOwnAvatarPath(newAvatarPath(otherUserId, 'image/png'), userId)).toBe(false);
    expect(isOwnAvatarPath(`${userId}/../${otherUserId}/avatar.png`, userId)).toBe(false);
    expect(isOwnAvatarPath(`${userId}/avatar.png`, userId)).toBe(false);
  });
});
