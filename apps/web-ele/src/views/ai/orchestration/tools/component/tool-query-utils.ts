export type ToolSearchType = 'create_user' | 'name';

export type ToolSearchValue = number | string;

export interface ToolSearchState {
  createUser?: unknown;
  create_user?: unknown;
  name?: unknown;
  searchType: ToolSearchType;
}

export interface CreatorUserLike {
  [key: string]: unknown;
  name?: unknown;
  nickname?: unknown;
  realName?: unknown;
  user_id?: unknown;
  userId?: unknown;
  username?: unknown;
}

function normalizeSearchValue(value: unknown): ToolSearchValue | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildToolSearchParams(state: ToolSearchState) {
  if (state.searchType === 'create_user') {
    const creatorId = normalizeSearchValue(
      state.create_user ?? state.createUser,
    );
    return creatorId === undefined
      ? {}
      : {
          createUser: creatorId,
          create_user: creatorId,
        };
  }

  const name = normalizeSearchValue(state.name);
  return name === undefined ? {} : { name };
}

export function normalizeCreatorLabel(user: CreatorUserLike) {
  const label = normalizeSearchValue(
    user.nickname ?? user.name ?? user.realName ?? user.username ?? user.userId,
  );
  return label === undefined ? '' : `${label}`;
}

export function normalizeCreatorValue(user: CreatorUserLike) {
  return normalizeSearchValue(user.userId ?? user.user_id ?? user.id);
}
