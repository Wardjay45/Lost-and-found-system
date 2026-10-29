// Expo Core is already part of the development APK. Android's UUID v4
// generator uses java.util.UUID.randomUUID(), backed by SecureRandom.
export function signupSaltBytes(uuidV4) {
  if (typeof uuidV4 !== 'function') throw new Error('Secure password salt unavailable');
  const bytes = new Uint8Array(16);
  for (let block = 0; block < 2; block++) {
    const uuid = uuidV4();
    if (typeof uuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
      throw new Error('Secure password salt unavailable');
    }
    const parts = uuid.split('-');
    // Extract 64 random bits per UUID, excluding version/variant bits.
    const hex = parts[0] + parts[1] + parts[4].slice(0, 4);
    for (let index = 0; index < 8; index++) {
      bytes[block * 8 + index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
  }
  return bytes;
}
