/**
 * Location Normalizer
 * Maps free-text location inputs to canonical names for consistent analytics.
 * QR locations are NOT affected — this only normalizes the lost/found item records.
 */

// Common abbreviations and their canonical names
const abbreviations = {
  'ab': 'Academic Building',
  'acad': 'Academic Building',
  'academic': 'Academic Building',
  'acad bldg': 'Academic Building',
  'acad building': 'Academic Building',
  'lib': 'Library',
  'main lib': 'Library',
  'library': 'Library',
  'gym': 'Gymnasium',
  'gymnasium': 'Gymnasium',
  'caf': 'Cafeteria',
  'cafe': 'Cafeteria',
  'cafeteria': 'Cafeteria',
  'mess hall': 'Cafeteria',
  'clinic': 'Clinic',
  'medical': 'Clinic',
  'health center': 'Clinic',
  'admin': 'Administration Building',
  'admin bldg': 'Administration Building',
  'administration': 'Administration Building',
  'auditorium': 'Auditorium',
  'aud': 'Auditorium',
  'chapel': 'Chapel',
  'parking': 'Parking Lot',
  'parking lot': 'Parking Lot',
  'parking area': 'Parking Lot',
  'dorm': 'Dormitory',
  'dormitory': 'Dormitory',
  'hostel': 'Dormitory',
  'science': 'Science Building',
  'sci bldg': 'Science Building',
  'science lab': 'Science Building',
  'eng': 'Engineering Building',
  'engg': 'Engineering Building',
  'engineering': 'Engineering Building',
  'eng bldg': 'Engineering Building',
  'it': 'IT Building',
  'it bldg': 'IT Building',
  'it center': 'IT Building',
  'computer lab': 'IT Building',
  'canteen': 'Cafeteria',
  'oval': 'Oval',
  'grandstand': 'Grandstand',
  'field': 'Field',
  'soccer field': 'Field',
  'football field': 'Field',
  'court': 'Court',
  'basketball court': 'Court',
  'tennis court': 'Court',
  'cr': 'Comfort Room',
  'comfort room': 'Comfort Room',
  'restroom': 'Comfort Room',
  'toilet': 'Comfort Room',
  'washroom': 'Comfort Room',
  'hallway': 'Hallway',
  'corridor': 'Hallway',
  'lobby': 'Lobby',
  'entrance': 'Entrance',
  'gate': 'Entrance',
  'main gate': 'Entrance',
};

// Floor/room suffixes mapping
const floorPatterns = [
  { pattern: /(\d)(?:st|nd|rd|th)?\s*(?:floor|flr|fl)\b/i, replacement: '$1st Floor' },
  { pattern: /floor\s*(\d)/i, replacement: '$1st Floor' },
  { pattern: /flr\s*(\d)/i, replacement: '$1st Floor' },
  { pattern: /(\d)(?:st|nd|rd|th)?\s*fl(?:oor)?/i, replacement: '$1st Floor' },
];

/**
 * Normalize a location string to its canonical form.
 * Preserves the original input but returns a cleaned version for storage.
 * 
 * @param {string} location - Raw location input from user
 * @param {Array} qrLocations - Optional array of QR location names to match against
 * @returns {string} Normalized location name
 */
export function normalizeLocation(location, qrLocations = []) {
  if (!location || typeof location !== 'string') return location;

  let normalized = location.trim();

  // Step 1: Check if it matches an existing QR location exactly (case-insensitive)
  if (qrLocations.length > 0) {
    const qrMatch = qrLocations.find(
      ql => ql.name && ql.name.toLowerCase() === normalized.toLowerCase()
    );
    if (qrMatch) return qrMatch.name;
  }

  // Step 2: Normalize floor/room suffixes
  for (const { pattern, replacement } of floorPatterns) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Step 3: Normalize building/area names
  // Split into parts (e.g., "Academic Building 3-1" or "AB 3-1")
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    // Try to match the beginning of the string for known abbreviations
    // Check progressively longer prefixes
    for (let i = parts.length; i >= 1; i--) {
      const prefix = parts.slice(0, i).join(' ').toLowerCase();
      if (abbreviations[prefix]) {
        const canonical = abbreviations[prefix];
        const suffix = parts.slice(i).join(' ');
        normalized = suffix ? `${canonical} ${suffix}` : canonical;
        break;
      }
    }
  }

  // Single word check
  const singleLower = normalized.toLowerCase();
  if (abbreviations[singleLower]) {
    normalized = abbreviations[singleLower];
  }

  // Step 4: Title case each word (except common words)
  const minorWords = ['of', 'the', 'in', 'at', 'and', 'a', 'an'];
  normalized = normalized
    .split(' ')
    .map((word, i) => {
      if (i > 0 && minorWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Run normalization on all existing lost and found items.
 * Call this when deploying the normalizer for the first time.
 */
export async function normalizeAllLocations(supabase) {
  const results = { lostUpdated: 0, foundUpdated: 0, totalChecked: 0 };

  // Normalize lost items
  const { data: lostItems } = await supabase.from('lost_items').select('id, location_lost');
  if (lostItems) {
    for (const item of lostItems) {
      const normalized = normalizeLocation(item.location_lost);
      if (normalized !== item.location_lost) {
        await supabase.from('lost_items')
          .update({ location_lost: normalized })
          .eq('id', item.id);
        results.lostUpdated++;
      }
    }
    results.totalChecked += lostItems.length;
  }

  // Normalize found items
  const { data: foundItems } = await supabase.from('found_items').select('id, location_found');
  if (foundItems) {
    for (const item of foundItems) {
      const normalized = normalizeLocation(item.location_found);
      if (normalized !== item.location_found) {
        await supabase.from('found_items')
          .update({ location_found: normalized })
          .eq('id', item.id);
        results.foundUpdated++;
      }
    }
    results.totalChecked += foundItems.length;
  }

  return results;
}

export { abbreviations };