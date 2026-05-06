import React, { useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  disabled?: boolean;
  onPress: () => void;
  colors: AppColors;
}

export function ActionTile({
  icon,
  title,
  subtitle,
  accentColor,
  bgColor,
  disabled = false,
  onPress,
  colors,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      disabled={disabled}
      style={styles.touchable}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ scale }],
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={22} color={accentColor} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {disabled && (
          <View style={[styles.soonBadge, { backgroundColor: colors.primaryDim }]}>
            <Text style={[styles.soonText, { color: colors.primary }]}>Soon</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { flex: 1 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  soonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  soonText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
