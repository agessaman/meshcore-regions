export function buildRegionCommands(tags, hierarchy, firmwareMode) {
  const lines = [];
  const added = new Set();

  for (const tag of tags) {
    if (added.has(tag)) {
      continue;
    }
    const parent = hierarchy[tag]?.parent ?? null;
    lines.push(parent ? `region put ${tag} ${parent}` : `region put ${tag}`);
    if (firmwareMode === "1.14.x") {
      lines.push(`region allowf ${tag}`);
    }
    added.add(tag);
  }

  lines.push("region save");
  return lines;
}

export function buildOutputModel({ resolution, recommendation, firmwareMode }) {
  return {
    repeaterType: recommendation.repeaterType,
    strategy: recommendation.strategy,
    source: resolution.source,
    primaryTag: resolution.primary.tag,
    secondaryTag: resolution.secondary?.tag ?? null,
    tags: recommendation.tags,
    commands: buildRegionCommands(recommendation.tags, recommendation.hierarchy, firmwareMode),
    notes: recommendation.notes
  };
}
