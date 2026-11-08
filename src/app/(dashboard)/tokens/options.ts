import type { ActionState } from "@/components/forms/action-state";

export const EXPIRATION_OPTIONS = [30, 90, 180, 365] as const;
export const DEFAULT_EXPIRATION = 90;

/** Create-token result: the plaintext token travels to the browser exactly once, here. */
export type CreateTokenState =
  ActionState | { status: "created"; message: string; token: string; name: string };

export interface TechnologyOption {
  slug: string;
  name: string;
}
