const app = require('../../src/app');
const openapi = require('../../src/config/swagger');

function mountPath(layer) {
  let source = layer.regexp.source.replace(/^\^/, '');
  const optionalSuffix = source.indexOf('\\/?(?=');
  if (optionalSuffix >= 0) source = source.slice(0, optionalSuffix);

  let parameterIndex = 0;
  source = source.replace(/\(\?:\\\/\(\[\^\/\]\+\?\)\)/g, () => {
    const parameter = layer.keys[parameterIndex];
    parameterIndex += 1;
    return `/:${parameter?.name || 'parameter'}`;
  });
  return source.replace(/\\\//g, '/');
}

function collectApiOperations(stack, prefix = '', operations = new Map()) {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = layer.route.path === '/' ? '' : layer.route.path;
      const fullPath = `${prefix}${routePath}`.replace(/\/$/, '') || '/';
      if (!fullPath.startsWith('/api/v1/')) continue;

      const path = fullPath.slice('/api/v1'.length).replace(/:([^/]+)/g, '{$1}') || '/';
      const methods = operations.get(path) || new Set();
      for (const method of Object.keys(layer.route.methods)) methods.add(method.toLowerCase());
      operations.set(path, methods);
    } else if (layer.name === 'router' && layer.handle.stack) {
      collectApiOperations(layer.handle.stack, prefix + mountPath(layer), operations);
    }
  }
  return operations;
}

describe('OpenAPI route contract', () => {
  test('documents every mounted /api/v1 route and HTTP method exactly once', () => {
    expect(app).toBeDefined();
    expect(openapi.openapi).toMatch(/^3\./);
    expect(openapi.servers).toContainEqual(expect.objectContaining({ url: '/api/v1' }));

    const actual = collectApiOperations(app._router.stack);
    const documentedPaths = Object.keys(openapi.paths).sort();
    expect([...actual.keys()].sort()).toEqual(documentedPaths);

    for (const [path, methods] of actual) {
      const documentedMethods = new Set(
        Object.keys(openapi.paths[path]).filter((key) => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(key))
      );
      expect([...documentedMethods].sort()).toEqual([...methods].sort());
    }
  });
});
