import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { profileInitial, profilePhotoSource } from '../../../shared/profilePhoto.mjs';

export default function ProfileAvatar({ user, size, fontSize, accessibilityLabel }) {
  const source = profilePhotoSource(user?.avatar);
  const [failedSource, setFailedSource] = useState(null);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {source && failedSource !== source
        ? <Image source={{ uri: source }} style={styles.image} resizeMode="cover"
            accessible={Boolean(accessibilityLabel)} accessibilityLabel={accessibilityLabel}
            onError={() => setFailedSource(source)} />
        : <Text accessible={false} style={[styles.initial, { fontSize }]}>{profileInitial(user?.name)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  initial: { color: '#fff', fontWeight: '700' },
});
