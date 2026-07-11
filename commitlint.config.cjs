/**
 * commitlint 配置 —— 强制 Conventional Commits 规范。
 * 铁律一·1 AST 级别自动审计：commit message 必须符合规范才能提交。
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'wip',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 120],
  },
};
