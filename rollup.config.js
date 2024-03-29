import resolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import commonjs from 'rollup-plugin-commonjs';
import svelte from 'rollup-plugin-svelte';
import babel from 'rollup-plugin-babel';
import postcss from 'rollup-plugin-postcss'
import sveltePreprocess from 'svelte-preprocess';
import { terser } from 'rollup-plugin-terser';
import PurgeSvelte from "purgecss-from-svelte";
import config from 'sapper/config/rollup.js';
import pkg from './package.json';
import path from 'path';

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

const onwarn = (warning, onwarn) => (warning.code === 'CIRCULAR_DEPENDENCY' && /[/\\]@sapper[/\\]/.test(warning.message)) || onwarn(warning);
const dedupe = importee => importee === 'svelte' || importee.startsWith('svelte/');

const postcssPlugins = [
  require("postcss-import")(),
  require("postcss-url")(),
  require("tailwindcss")("./tailwind.config.js"),
  require("autoprefixer")({ browserlist: "last 1 version" }),
  require("cssnano")({preset: 'default'}),
];

const purgecss = require('@fullhuman/postcss-purgecss')({
  content: ["./src/**/*.svelte"],
  extractors: [
    {
      extractor: PurgeSvelte,
      extensions: ["svelte"]
    }
  ]
});

const preprocess = sveltePreprocess({
  transformers: {
    postcss: {
      plugins: postcssPlugins
    }
  }
});

export default {
  client: {
    input: config.client.input(),
    output: config.client.output(),
    plugins: [
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        preprocess,
        dev,
        hydratable: true,
        emitCss: true,
      }),
      resolve({
        browser: true,
        dedupe,
      }),
      commonjs(),

      legacy && babel({
        extensions: ['.js', '.mjs', '.html', '.svelte'],
        runtimeHelpers: true,
        exclude: ['node_modules/@babel/**'],
        presets: [
          ['@babel/preset-env', {
            targets: '> 0.25%, not dead'
          }]
        ],
        plugins: [
          '@babel/plugin-syntax-dynamic-import',
          ['@babel/plugin-transform-runtime', {
            useESModules: true
          }]
        ]
      }),

      !dev && terser({
        module: true,
      })
    ],

    onwarn,
  },

  server: {
    input: config.server.input(),
    output: config.server.output(),
    plugins: [
      replace({
        'process.browser': false,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        generate: 'ssr',
        dev,
        preprocess,
      }),
      resolve({
        dedupe
      }),
      postcss({
        plugins: [ ...postcssPlugins, !dev && purgecss],
        extract: path.resolve(__dirname, './static/global.css'),
      }),
      commonjs()
    ],
    external: Object.keys(pkg.dependencies).concat(
      require('module').builtinModules || Object.keys(process.binding('natives'))
    ),

    onwarn,
  },

  serviceworker: {
    input: config.serviceworker.input(),
    output: config.serviceworker.output(),
    plugins: [
      resolve(),
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode)
      }),
      commonjs(),
      !dev && terser()
    ],

    onwarn,
  }
};
