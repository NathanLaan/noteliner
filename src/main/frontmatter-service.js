// YAML frontmatter mirror.
//
// `noteliner.json` remains the authoritative metadata. This service maintains
// a derived YAML block at the top of each `.md` so the file is portable —
// other tools (Obsidian, Tolaria, static-site generators, grep) can read its
// id, name, and tags without parsing the sidecar index.
//
// Mirror fields are managed by NoteLiner; user-added fields are preserved
// untouched on rewrites — that's the interop bargain.

const matter = require('gray-matter');

// The closed set NoteLiner manages. Anything else in frontmatter is the
// user's (or another tool's) — left as-is on every rewrite.
const MIRROR_FIELDS = ['id', 'name', 'tags', 'created', 'updated'];

class FrontmatterService {
  // Returns { data, body }. Malformed or missing frontmatter yields
  // { data: {}, body: raw }.
  parse(raw) {
    if (typeof raw !== 'string') return { data: {}, body: raw == null ? '' : String(raw) };
    try {
      const parsed = matter(raw);
      return { data: parsed.data || {}, body: parsed.content };
    } catch {
      return { data: {}, body: raw };
    }
  }

  // Strips frontmatter and returns body only. Convenience wrapper.
  stripBody(raw) {
    return this.parse(raw).body;
  }

  // Returns full file string with frontmatter prepended. If `data` is empty,
  // returns body unchanged (avoids emitting `--- ---` blocks).
  serialize(body, data) {
    const cleaned = this.cleanData(data);
    if (Object.keys(cleaned).length === 0) return body;
    // Order managed fields first for stable diffs, then user fields.
    const ordered = {};
    for (const k of MIRROR_FIELDS) {
      if (cleaned[k] !== undefined) ordered[k] = cleaned[k];
    }
    for (const k of Object.keys(cleaned)) {
      if (!MIRROR_FIELDS.includes(k)) ordered[k] = cleaned[k];
    }
    return matter.stringify(body, ordered);
  }

  // Drop nullish managed fields so they don't render as `tags: null`.
  cleanData(data) {
    const out = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (v == null) continue;
      out[k] = v;
    }
    return out;
  }

  // Compose the data block from an index entry, preserving any user-added
  // fields from the existing frontmatter.
  mirrorFromIndexEntry(entry, existingData = {}) {
    const data = { ...existingData };
    data.id = entry.id;
    data.name = entry.name;
    data.tags = Array.isArray(entry.tags) ? [...entry.tags] : [];
    if (!data.created) data.created = new Date().toISOString();
    data.updated = new Date().toISOString();
    return data;
  }

  // Compares mirror fields between two data objects. True if any mirrored
  // field differs (used to decide whether a file needs a frontmatter rewrite).
  mirrorDiverges(a, b) {
    for (const k of MIRROR_FIELDS) {
      if (k === 'updated') continue; // updated always changes; ignore for divergence
      const av = a?.[k];
      const bv = b?.[k];
      if (Array.isArray(av) || Array.isArray(bv)) {
        const aa = Array.isArray(av) ? av : [];
        const bb = Array.isArray(bv) ? bv : [];
        if (aa.length !== bb.length) return true;
        for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return true;
      } else if (av !== bv) {
        return true;
      }
    }
    return false;
  }
}

module.exports = { FrontmatterService, MIRROR_FIELDS };
