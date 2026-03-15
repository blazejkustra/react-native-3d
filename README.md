# react-native-3d

https://github.com/user-attachments/assets/324e4627-839b-4e27-b4e4-fc18ae2d65e1

> **Experimental** — APIs may change without notice. Relies on `react-native-worklets` bundle mode, which is not enabled by default yet.

WebGPU-powered 3D model viewer for React Native. Load `.glb` (glTF Binary) models and display them in your app with real-time rendering on a dedicated background thread.

## Features

- **WebGPU rendering** via `react-native-wgpu`
- **Off-thread rendering** using `react-native-worklets` bundle mode -- the GPU render loop runs on a separate JS runtime, keeping the main thread free
- **GLB model loading** with built-in parser (positions, normals, texCoords, textures)
- **Orbit camera** with pan and pinch gestures (`react-native-gesture-handler`)
- **Lighting presets** (studio, outdoor, neutral) with configurable intensity
- **Auto-rotation** around any axis

## Installation

```sh
npm install react-native-3d
```

### Peer dependencies

```sh
npm install react-native-wgpu react-native-worklets react-native-gesture-handler
```

### Bundle mode setup

This library relies on `react-native-worklets` [Bundle Mode](https://docs.swmansion.com/react-native-worklets/docs/bundleMode). You need to configure Metro and Babel in your app.

**package.json** (add at root level)

```json
{
  "worklets": {
    "staticFeatureFlags": {
      "BUNDLE_MODE_ENABLED": true,
      "FETCH_PREVIEW_ENABLED": true
    }
  }
}
```

<details>
<summary><b>Bare React Native</b></summary>

**babel.config.js**

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['react-native-worklets/plugin', { bundleMode: true, strictGlobal: true }],
  ],
};
```

**metro.config.js**

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');

let config = mergeConfig(getDefaultConfig(__dirname), {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        inlineRequires: true,
      },
    }),
  },
});

module.exports = getBundleModeMetroConfig(config);
```

</details>

<details>
<summary><b>Expo</b></summary>

Install the dev dependency:

```sh
npx expo install babel-preset-expo
```

**babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets/plugin', { bundleMode: true, strictGlobal: true }],
    ],
  };
};
```

**metro.config.js**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');

let config = getDefaultConfig(__dirname);

config = getBundleModeMetroConfig(config);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
};

module.exports = config;
```

</details>

## Usage

```tsx
import { Preview3D } from 'react-native-3d';

export default function ModelViewer() {
  return (
    <Preview3D
      url="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
      style={{ width: '100%', height: 300 }}
      lighting={{ preset: 'studio' }}
      autoRotate={{ axis: 'y', speed: 1 }}
    />
  );
}
```

### Props

| Prop            | Type                                  | Default                 | Description                      |
| --------------- | ------------------------------------- | ----------------------- | -------------------------------- |
| `url`           | `string`                              | required                | URL of the `.glb` model          |
| `lighting`      | `{ preset?, intensity?, ambient? }`   | `{ preset: 'studio' }`  | Lighting configuration           |
| `gestures`      | `boolean`                             | `true`                  | Enable pan/pinch camera gestures |
| `autoRotate`    | `{ axis?: 'x'\|'y', speed?: number }` | -                       | Continuous rotation              |
| `initialAngleX` | `number`                              | `0`                     | Initial X rotation (radians)     |
| `initialAngleY` | `number`                              | `0`                     | Initial Y rotation (radians)     |
| `initialZoom`   | `number`                              | `1`                     | Initial zoom level               |
| `loading`       | `ReactNode`                           | `<ActivityIndicator />` | Custom loading indicator         |
| `style`         | `ViewStyle`                           | -                       | Container style                  |
| `onLoad`        | `() => void`                          | -                       | Called when first frame renders  |
| `onError`       | `(error: Error) => void`              | -                       | Called on failure                |

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
