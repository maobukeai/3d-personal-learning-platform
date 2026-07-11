/**
 * ESLint custom rule: no-window-global-state
 * 禁止通过 window 全局对象传递未隔离的应用状态（铁律一·3 多维沙箱隔离）。
 *
 * 触发条件：`window.<ident> = <expr>` 赋值表达式，且 ident 不在白名单内。
 * 白名单允许的是浏览器原生 API 与框架约定的只读元数据。
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止通过 window 全局对象传递未隔离的应用状态',
      url: 'https://example.local/eslint-rules/no-window-global-state',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noGlobalState:
        '禁止通过 window.{{name}} 传递应用状态。请使用 Pinia store / mitt 事件总线 / props-emits 通信。',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    /** 浏览器原生 API 与框架约定的只读元数据白名单。 */
    const DEFAULT_ALLOW = new Set([
      '__APP_VERSION__',
      '__APP_BUILD_TIME__',
      '__VUE_DEVTOOLS_GLOBAL_HOOK__',
      'location',
      'name',
    ]);
    const allow = new Set([...DEFAULT_ALLOW, ...(options.allow || [])]);

    return {
      AssignmentExpression(node) {
        const { left } = node;
        if (!left || left.type !== 'MemberExpression') return;
        const { object, property, computed } = left;

        // window.xxx = ... 或 window['xxx'] = ...
        const isWindowObject =
          (object.type === 'Identifier' && object.name === 'window') ||
          (object.type === 'Identifier' && object.name === 'globalThis');

        if (!isWindowObject) return;

        let name = null;
        if (!computed && property && property.type === 'Identifier') {
          name = property.name;
        } else if (
          computed &&
          property &&
          property.type === 'Literal' &&
          typeof property.value === 'string'
        ) {
          name = property.value;
        }

        if (name && !allow.has(name)) {
          context.report({ node: left, messageId: 'noGlobalState', data: { name } });
        }
      },
      // window.xxx = yyy 也可能通过 UpdateExpression（如 window.count++）
      UpdateExpression(node) {
        const { argument } = node;
        if (!argument || argument.type !== 'MemberExpression') return;
        const { object, property, computed } = argument;
        const isWindowObject =
          (object.type === 'Identifier' && object.name === 'window') ||
          (object.type === 'Identifier' && object.name === 'globalThis');
        if (!isWindowObject) return;

        let name = null;
        if (!computed && property && property.type === 'Identifier') {
          name = property.name;
        }
        if (name && !allow.has(name)) {
          context.report({ node: argument, messageId: 'noGlobalState', data: { name } });
        }
      },
    };
  },
};

export default rule;
