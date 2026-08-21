module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/storefront/postcss.config.mjs { CONFIG => \"[project]/storefront/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/03dv_11-fjis._.js",
  "chunks/[root-of-the-server]__0h_mjwo._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/storefront/postcss.config.mjs { CONFIG => \"[project]/storefront/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];