import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';
import { getInitials } from '../utils/helpers';

interface Props {
  name: string;
  uri?: string;
  size?: number;
  bgColor?: string;
}

export const Avatar: React.FC<Props> = ({ name, uri, size = 44, bgColor }) => {
  const bg = bgColor ?? colors.primary;
  const fontSize = size * 0.38;
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: colors.white, fontWeight: '700', letterSpacing: 0.5 },
});
