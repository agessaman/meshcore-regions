function uniqueOrdered(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function sharedPrefix(a, b) {
  const out = [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) {
      break;
    }
    out.push(a[i]);
  }
  return out;
}

function shouldDualCarryUrban(resolution) {
  if (!resolution.secondary || !resolution.overlapLikely) {
    return false;
  }
  return true;
}

function highSiteStrategy(resolution) {
  if (!resolution.secondary) {
    return "single-metro";
  }
  if (!resolution.overlapLikely) {
    return "single-metro";
  }

  const distanceDelta = Math.abs(
    resolution.primary.centroidDistanceKm - resolution.secondary.centroidDistanceKm
  );
  if (distanceDelta <= 10) {
    return "dual-metro";
  }
  if (distanceDelta >= 28) {
    return "state-only";
  }
  return "single-metro";
}

export function recommendedTagsForRepeater(resolution, repeaterType) {
  const primaryAncestry = resolution.primary.ancestry;
  const primaryLocalTag = resolution.primary.tag;
  const manualCarryAlsoTags = resolution.manualCarryAlsoTags ?? [];
  const manualNote = resolution.manualOverride?.reason
    ? `Manual map override applied: ${resolution.manualOverride.reason}`
    : null;
  const nearBoundaryDual =
    Boolean(resolution.secondary) &&
    resolution.overlapLikely &&
    resolution.secondary.ancestry[3] === primaryAncestry[3];

  if (repeaterType === "residential") {
    const tags = [...primaryAncestry];
    const notes = ["Residential profile carries full ancestry for the selected local area."];
    tags.push(...manualCarryAlsoTags);
    if (manualNote) {
      notes.push(manualNote);
    }
    if (nearBoundaryDual) {
      tags.push(resolution.secondary.tag);
      notes.push(
        `Boundary overlap detected; dual local carry included (${primaryLocalTag} + ${resolution.secondary.tag}).`
      );
    }
    return {
      strategy: nearBoundaryDual ? "dual-metro" : "single-metro",
      tags: uniqueOrdered(tags),
      notes
    };
  }

  if (repeaterType === "urban") {
    const tags = [...primaryAncestry];
    const notes = ["Urban infrastructure defaults to one metro with full ancestry."];
    tags.push(...manualCarryAlsoTags);
    if (manualNote) {
      notes.push(manualNote);
    }
    if (shouldDualCarryUrban(resolution)) {
      tags.push(resolution.secondary.tag);
      notes.push(
        `Dual-carry added because point falls in overlapping coverage (${primaryLocalTag} + ${resolution.secondary.tag}).`
      );
    }
    return {
      strategy: tags.length > primaryAncestry.length ? "dual-metro" : "single-metro",
      tags: uniqueOrdered(tags),
      notes
    };
  }

  if (repeaterType === "high-site") {
    const strategy = highSiteStrategy(resolution);
    if (strategy === "state-only") {
      const tags = primaryAncestry.slice(0, Math.min(3, primaryAncestry.length));
      tags.push(...manualCarryAlsoTags);
      const notes = [
        "High-site profile selected state/province-level only to avoid forwarding local chatter across long-haul paths."
      ];
      if (manualNote) {
        notes.push(manualNote);
      }
      return {
        strategy,
        tags: uniqueOrdered(tags),
        notes
      };
    }

    if (strategy === "dual-metro") {
      const common = sharedPrefix(primaryAncestry, resolution.secondary.ancestry);
      const tags = [...common, primaryLocalTag, resolution.secondary.tag];
      return {
        strategy,
        tags: uniqueOrdered([...tags, ...manualCarryAlsoTags]),
        notes: [
          "High-site profile selected dual metro due to near-boundary overlap.",
          "Use dual-metro sparingly to preserve metro-level scoping behavior.",
          ...(manualNote ? [manualNote] : [])
        ]
      };
    }

    const notes = ["High-site profile selected single metro affiliation with full ancestry."];
    if (manualNote) {
      notes.push(manualNote);
    }
    return {
      strategy,
      tags: uniqueOrdered([...primaryAncestry, ...manualCarryAlsoTags]),
      notes
    };
  }

  return {
    strategy: "single-metro",
    tags: uniqueOrdered(primaryAncestry),
    notes: ["Unknown repeater type, defaulting to full ancestry."]
  };
}
