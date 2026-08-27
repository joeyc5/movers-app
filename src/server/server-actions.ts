"use server";

import { cookies } from "next/headers";

import {
  getPreferencePersistence,
  PREFERENCE_KEYS,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

/**
 * Every exported function in a "use server" file is a public HTTP endpoint that
 * anyone can POST to. TypeScript types are erased at runtime, so the allowlist
 * below is a real runtime check, not a formality.
 *
 * This previously accepted an arbitrary cookie name, which — once real auth
 * ships — is a read/write primitive on the Supabase session cookie itself
 * (`sb-<ref>-auth-token`): read it and you have the caller's token, write it and
 * you have session fixation. A companion `getValueFromCookie(key: string)` was
 * removed outright; it had no callers and was purely a way to exfiltrate a
 * cookie the browser is not supposed to be able to read.
 */
function assertPreferenceKey(key: string): asserts key is PreferenceKey {
  if (!(PREFERENCE_KEYS as readonly string[]).includes(key)) {
    throw new Error("Unknown preference key.");
  }
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  assertPreferenceKey(key);

  // The value is bounded too: a preference is one of a fixed set of strings, so
  // an arbitrary payload has no business being written under its name.
  const allowedValues = PREFERENCE_REGISTRY[key].values as readonly string[];
  if (!allowedValues.includes(value)) {
    throw new Error("Invalid preference value.");
  }

  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    path: options.path ?? "/",
    maxAge: options.maxAge ?? 60 * 60 * 24 * 7, // default: 7 days
    sameSite: "lax",
  });
}

export async function getPreference<K extends PreferenceKey>(key: K): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);

  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }

  const cookieStore = await cookies();
  return parsePreference(key, cookieStore.get(key)?.value.trim());
}
