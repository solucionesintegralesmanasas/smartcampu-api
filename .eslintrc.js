module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: ['airbnb-base'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      impliedStrict: true,
    },
  },
  rules: {
    // Estilo y formato
    'linebreak-style': ['error', 'unix'],
    'max-len': ['error', { code: 100, ignoreComments: true, ignoreStrings: true }],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // Importaciones
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['**/*.test.js', '**/*.spec.js', '**/tests/**'] },
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // Nomenclatura
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],
    'no-underscore-dangle': ['error', { allow: ['_id', '__v'] }],

    // Funciones y clases
    'class-methods-use-this': 'off',
    'no-param-reassign': ['error', { props: false }],
    'prefer-destructuring': ['error', { object: true, array: false }],
    'consistent-return': 'off',

    // Promesas y async
    'no-return-await': 'error',
    'require-await': 'off',

    // Errores y validaciones
    'no-throw-literal': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  overrides: [
    {
      files: ['*.test.js', '*.spec.js', '*.e2e.js', '**/tests/**/*.js'],
      rules: {
        'no-unused-expressions': 'off',
        'no-underscore-dangle': 'off',
        'max-len': 'off',
        'global-require': 'off',
      },
    },
    {
      files: ['*.config.js', '*.config.mjs', '.eslintrc.js'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'global-require': 'off',
      },
    },
    {
      files: ['scripts/**/*.js', '**/seed/**/*.js', '**/migrations/**/*.js'],
      rules: {
        'no-console': 'off',
        'no-restricted-syntax': 'off',
        'no-await-in-loop': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['packages/**/*.js'],
      rules: {
        'global-require': 'off',
        'no-restricted-syntax': 'off',
        'no-await-in-loop': 'off',
        'no-plusplus': 'off',
        'no-continue': 'off',
        'no-loop-func': 'off',
        'no-console': 'off',
        'no-underscore-dangle': 'off',
        'no-nested-ternary': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/order': 'off',
        'import/newline-after-import': 'off',
        'max-classes-per-file': 'off',
        'no-promise-executor-return': 'off',
        'max-len': 'off',
      },
    },
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.json'],
        moduleDirectory: ['node_modules', 'src'],
      },
    },
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.turbo/', '*.min.js'],
};
