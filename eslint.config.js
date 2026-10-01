const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', '.git/**', 'scratch/**', 'assets/**', 'functions/node_modules/**', 'functions/lib/**'] },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-constant-condition': 'error'
    }
  },
  { files: ['functions/**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node } }
];
