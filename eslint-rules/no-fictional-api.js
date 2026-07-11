/**
 * ESLint custom rule: no-fictional-api
 * 拦截虚构 API 调用 —— 检测 fetch/axios 调用中包含明显占位/虚构前缀的 URL。
 *
 * 触发条件：字符串字面量（或模板字面量）作为 fetch / axios.{get,post,put,delete,patch} 的首参，
 * 且 URL 路径包含下列虚构标记之一（大小写不敏感）：
 *   fake- / mock- / dummy- / placeholder- / todo-api / xxx-api / yyy-api / FIXME / TODO
 *
 * 豁免：以 http(s):// 开头且不含上述标记的真实 URL；非字符串字面量（变量）不校验。
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止调用包含虚构/占位前缀的 API 路径',
      url: 'https://example.local/eslint-rules/no-fictional-api',
    },
    schema: [],
    messages: {
      fictional:
        '检测到虚构/占位 API 路径 "{{url}}"。禁止提交 mock/fake/dummy/TODO 等占位接口，请使用真实后端路由。',
    },
  },
  create(context) {
    const FICTIONAL_PATTERNS = [
      /fake-/i,
      /mock-/i,
      /dummy-/i,
      /placeholder-/i,
      /todo-api/i,
      /xxx-api/i,
      /yyy-api/i,
      /\/api\/todo\b/i,
      /\bFIXME\b/i,
      /\bTODO\b/i,
      /\bXXX\b/,
      /\bYYY\b/,
    ];

    /** 从 Literal 或 TemplateLiteral 节点提取字符串值，无法静态求值则返回 null。 */
    function extractString(node) {
      if (!node) return null;
      if (node.type === 'Literal') {
        return typeof node.value === 'string' ? node.value : null;
      }
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis.map((q) => q.value.cooked).join('');
      }
      return null;
    }

    function checkUrl(node) {
      const url = extractString(node);
      if (url == null) return;
      if (FICTIONAL_PATTERNS.some((re) => re.test(url))) {
        context.report({ node, messageId: 'fictional', data: { url } });
      }
    }

    return {
      // fetch(url, ...)
      CallExpression(node) {
        const { callee } = node;
        if (!callee) return;

        // 直接 fetch(...)
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          checkUrl(node.arguments[0]);
          return;
        }

        // axios.get/post/put/delete/patch(url, ...)
        if (callee.type === 'MemberExpression') {
          const prop = callee.property;
          const isAxiosMethod =
            prop &&
            prop.type === 'Identifier' &&
            ['get', 'post', 'put', 'delete', 'patch', 'request'].includes(prop.name);
          const isAxiosObject =
            (callee.object.type === 'Identifier' && callee.object.name === 'axios') ||
            (callee.object.type === 'Identifier' && callee.object.name === 'api');
          if (isAxiosMethod && isAxiosObject) {
            // axios(url, config) 或 axios.get(url) 的首参
            checkUrl(node.arguments[0]);
          }
        }
      },
    };
  },
};

export default rule;
