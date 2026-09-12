import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image } from 'react-native';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const { Navigator } = createMaterialTopTabNavigator();

// Only keep explicitly declared screens so redirect-only `index` is not appended.
export const SwipeableTabs = withLayoutContext(
  Navigator,
  (screens) => screens.filter((screen) => screen.name !== 'index'),
  true
);

function isHiddenTab(options) {
  if (options?.href === null) return true;
  if (options?.href === '') return true;
  const style = options?.tabBarItemStyle;
  if (style?.display === 'none' || style?.width === 0) return true;
  return false;
}

export function TabsHeaderLogo() {
  const { gymLogo } = useAuth();
  if (!gymLogo) return null;
  return (
    <Image
      style={{ width: 120, height: 70, resizeMode: 'contain' }}
      source={{ uri: gymLogo }}
    />
  );
}

/** Shared gym-colored header (Material Top Tabs have no built-in header). */
export function SwipeableTabsHeader({ backgroundColor }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor, paddingTop: insets.top }}>
      <View
        style={{
          height: Platform.select({ ios: 70, android: 56 }),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TabsHeaderLogo />
      </View>
    </View>
  );
}

/**
 * Bottom tab bar that keeps the existing look while Material Top Tabs
 * provide swipe between screens.
 */
export function SwipeableBottomTabBar({
  state,
  descriptors,
  navigation,
  activeColor,
  inactiveColor,
  backgroundColor,
}) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((route) => {
    if (route.name === 'index') return false;
    const { options } = descriptors[route.key];
    return !isHiddenTab(options);
  });

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 6),
          borderTopColor: 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const { options } = descriptors[route.key];
        const focused = state.index === routeIndex;
        const color = focused ? activeColor : inactiveColor;
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;
        const icon = options.tabBarIcon?.({
          focused,
          color,
          size: 24,
        });

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ??
              (typeof label === 'string' ? label : route.name)
            }
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
          >
            <View style={styles.iconWrap}>{icon}</View>
            {typeof label === 'function' ? (
              label({ focused, color })
            ) : (
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function getSwipeableTabScreenOptions() {
  return {
    swipeEnabled: true,
    animationEnabled: true,
    lazy: true,
    lazyPreloadDistance: 0,
    tabBarShowIcon: true,
    tabBarIndicatorStyle: { height: 0 },
    sceneStyle: { backgroundColor: 'transparent' },
  };
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
  iconWrap: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});
