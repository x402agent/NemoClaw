---
applyTo: "**"
---
# React Native Pager View (pump-fun/react-native-pager-view)

## Skill Description

Reference the React Native Pager View documentation when building swipeable page interfaces in Pump's mobile app. This is Pump's fork of callstack/react-native-pager-view — the standard native pager component for React Native.

**Repository:** [pump-fun/react-native-pager-view](https://github.com/pump-fun/react-native-pager-view) (fork of [callstack/react-native-pager-view](https://github.com/callstack/react-native-pager-view))

## When to Use

- Building swipeable page/tab interfaces in the Pump mobile app
- Implementing token detail pages, onboarding flows, or chart carousels
- Debugging page scroll/swipe issues on iOS or Android
- Working with React Native Reanimated page scroll handlers
- Implementing custom tab bars or pagination dots

## Key Component

```jsx
import PagerView from 'react-native-pager-view';

<PagerView style={{ flex: 1 }} initialPage={0}>
  <View key="1"><Text>First page</Text></View>
  <View key="2"><Text>Second page</Text></View>
</PagerView>
```

## API

| Prop | Description | Platform |
|------|-------------|----------|
| `initialPage: number` | Index of initial page | both |
| `scrollEnabled: boolean` | Enable/disable swiping | both |
| `orientation: 'horizontal' \| 'vertical'` | Scroll direction (static only) | both |
| `pageMargin: number` | Blank space between pages | both |
| `keyboardDismissMode: 'none' \| 'on-drag'` | Dismiss keyboard on drag | both |
| `overdrag: boolean` | Overscroll at edges | iOS |
| `offscreenPageLimit: number` | Pages retained off-screen | Android |
| `layoutDirection: 'ltr' \| 'rtl' \| 'locale'` | Layout direction | both |

| Event | Description |
|-------|-------------|
| `onPageScroll` | Fired during page transitions (position + offset) |
| `onPageSelected` | Fired when page selection completes |
| `onPageScrollStateChanged` | Scroll state: idle, dragging, settling |

| Method | Description |
|--------|-------------|
| `setPage(index)` | Navigate with animation |
| `setPageWithoutAnimation(index)` | Navigate without animation |
| `setScrollEnabled(bool)` | Imperatively toggle scroll |

## usePagerView Hook

```jsx
import { usePagerView } from 'react-native-pager-view';

const { AnimatedPagerView, ref, ...rest } = usePagerView({ pagesAmount: 10 });

<AnimatedPagerView ref={ref} style={{ flex: 1 }} {...rest}>
  {rest.pages.map((_, i) => <View key={i}>...</View>)}
</AnimatedPagerView>
```

## Reanimated Integration

```jsx
import PagerView from 'react-native-pager-view';
import Animated, { useHandler, useEvent } from 'react-native-reanimated';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

// Worklet-based scroll handler
const handler = usePagerScrollHandler({
  onPageScroll: (e) => { 'worklet'; offset.value = e.offset; },
});

<AnimatedPager onPageScroll={handler} />
```

## Known Issues

1. `flex: 1` doesn't work for child views — use `width: '100%', height: '100%'` instead
2. iOS: `UIViewControllerHierarchyInconsistency` — fix with `requestAnimationFrame(() => ref.current?.setPage(index))`
3. Children must be `<View>` components, not composite components
4. Android: Set `collapsable={false}` on child Views to prevent removal

## Native Implementation

| Platform | Backing Component |
|----------|-------------------|
| Android | `ViewPager2` (AndroidX) |
| iOS | `UIPageViewController` |
| visionOS | Supported |
