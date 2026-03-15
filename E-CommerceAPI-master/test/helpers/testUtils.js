const path = require("node:path");

function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    rendered: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    render(view, locals) {
      this.rendered = { view, locals };
      this.body = locals;
      return this;
    },
  };
}

function createNextSpy() {
  const state = {
    called: false,
    args: [],
  };

  const next = (...args) => {
    state.called = true;
    state.args = args;
  };

  next.called = () => state.called;
  next.args = () => state.args;

  return next;
}

function stubMethod(target, key, replacement) {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
}

function stubProperty(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function createDocument(data = {}) {
  const document = { ...data };
  document.saveCallCount = 0;
  document.save = async () => {
    document.saveCallCount += 1;
    return document;
  };
  document.toObject = () =>
    Object.fromEntries(
      Object.entries(document).filter(
        ([key, value]) => typeof value !== "function" && key !== "saveCallCount",
      ),
    );
  document.get = (key) => document[key];
  return document;
}

function createObjectIdRef(id) {
  return {
    _id: id,
    equals(value) {
      if (value && typeof value === "object" && "_id" in value) {
        return String(value._id) === id;
      }

      return String(value) === id;
    },
    toString() {
      return id;
    },
  };
}

function createPopulateChain(result, options = {}) {
  const chain = {
    sort() {
      return chain;
    },
    select() {
      return chain;
    },
    populate() {
      return Promise.resolve(result);
    },
  };

  if (options.selectOnly) {
    chain.populate = undefined;
    chain.select = () => Promise.resolve(result);
  }

  return chain;
}

function getRouteLayer(router, pathName) {
  return router.stack.find((layer) => layer.route && layer.route.path === pathName);
}

function getRouteHandlerNames(router, pathName, method) {
  const layer = getRouteLayer(router, pathName);
  if (!layer) {
    return [];
  }

  return layer.route.stack
    .filter((stackLayer) => stackLayer.method === method)
    .map((stackLayer) => stackLayer.handle.name || "anonymous");
}

function backendDistPath(...segments) {
  return path.resolve(__dirname, "..", "..", "dist", ...segments);
}

module.exports = {
  backendDistPath,
  createDocument,
  createMockRequest,
  createMockResponse,
  createNextSpy,
  createObjectIdRef,
  createPopulateChain,
  getRouteHandlerNames,
  getRouteLayer,
  stubMethod,
  stubProperty,
};
