export function formatProfiles(profiles: string[]): string {
  if (profiles.length === 0) {
    return "No profiles defined";
  }

  const sections: string[] = ["📋 Available profiles"];

  for (const profile of profiles) {
    sections.push(profile);
  }

  return sections.join("\n");
}

export function formatProfilesAsJson(profiles: string[]): string {
  return JSON.stringify(profiles);
}
