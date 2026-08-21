module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/storefront/app/icon.svg (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/icon.0zsyt7zdgmf7n.svg" + (globalThis["NEXT_CLIENT_ASSET_SUFFIX"] || ''));}),
"[project]/storefront/app/icon.svg.mjs { IMAGE => \"[project]/storefront/app/icon.svg (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$app$2f$icon$2e$svg__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/storefront/app/icon.svg (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$app$2f$icon$2e$svg__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 512,
    height: 512
};
}),
"[project]/storefront/app/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ProductCard$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/ProductCard.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/Sections.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/lib/catalogue.ts [app-rsc] (ecmascript)");
;
;
;
;
/**
 * One page, numbered like a contents page.
 *
 * Five products do not need five routes. What they do need is an order that
 * matches how somebody decides: see the name, see the clothes, see the bag
 * and its chart, then read what booking actually commits you to, then find
 * the number to message.
 */ const RACKS = [
    {
        key: 'tshirt',
        index: '01 — Aesthura',
        title: 'Tees'
    },
    {
        key: 'hoodie',
        index: '02 — BAPE & more',
        title: 'Hoodies'
    }
];
function Home() {
    let plate = 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Nav"], {}, void 0, false, {
                fileName: "[project]/storefront/app/page.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Hero"], {}, void 0, false, {
                        fileName: "[project]/storefront/app/page.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Ticker"], {}, void 0, false, {
                        fileName: "[project]/storefront/app/page.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this),
                    RACKS.map((rack)=>{
                        const items = __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PRODUCTS"].filter((p)=>p.category === rack.key);
                        if (items.length === 0) return null;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "mx-auto max-w-[104rem] px-5 py-20 sm:py-28",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SectionHead"], {
                                    id: rack.key,
                                    index: rack.index,
                                    title: rack.title
                                }, void 0, false, {
                                    fileName: "[project]/storefront/app/page.tsx",
                                    lineNumber: 42,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2",
                                    children: items.map((product)=>{
                                        plate += 1;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ProductCard$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ProductCard"], {
                                            product: product,
                                            index: String(plate).padStart(2, '0')
                                        }, product.slug, false, {
                                            fileName: "[project]/storefront/app/page.tsx",
                                            lineNumber: 47,
                                            columnNumber: 21
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/storefront/app/page.tsx",
                                    lineNumber: 43,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, rack.key, true, {
                            fileName: "[project]/storefront/app/page.tsx",
                            lineNumber: 41,
                            columnNumber: 13
                        }, this);
                    }),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Bags"], {}, void 0, false, {
                        fileName: "[project]/storefront/app/page.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Booking"], {}, void 0, false, {
                        fileName: "[project]/storefront/app/page.tsx",
                        lineNumber: 60,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/app/page.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Sections$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Footer"], {}, void 0, false, {
                fileName: "[project]/storefront/app/page.tsx",
                lineNumber: 62,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/app/page.tsx",
        lineNumber: 30,
        columnNumber: 5
    }, this);
}
}),
"[project]/storefront/app/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/storefront/app/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/storefront/components/ProductCard.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProductCard",
    ()=>ProductCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/lib/catalogue.ts [app-rsc] (ecmascript)");
;
;
function ProductCard({ product, index }) {
    const [front, ...rest] = product.images;
    const back = rest[rest.length - 1];
    /**
   * The shirts were shot full-length in portrait, so a square-ish frame cut
   * straight through the model's head. A tall frame cropped high keeps the
   * print - the thing being sold - in the middle of the plate.
   */ const fit = product.fit === 'contain' ? 'object-contain' : 'object-cover object-[50%_20%]';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "group",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative aspect-3/4 overflow-hidden border border-line bg-plate",
                children: [
                    front ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: front,
                                alt: `${product.name} ${product.colour}`,
                                className: `absolute inset-0 h-full w-full ${fit} transition-opacity duration-500 group-hover:opacity-0`,
                                loading: "lazy"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 35,
                                columnNumber: 13
                            }, this),
                            back && /* eslint-disable-next-line @next/next/no-img-element */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                src: back,
                                alt: `${product.name}, other side`,
                                className: `absolute inset-0 h-full w-full ${fit} opacity-0 transition-opacity duration-500 group-hover:opacity-100`,
                                loading: "lazy"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 43,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 33,
                        columnNumber: 11
                    }, this) : /**
           * No photograph yet.
           *
           * The hoodies are special orders and the shop has not shot them. A
           * stock picture of somebody else's hoodie is the one thing the
           * sales memory forbids outright, so the plate says so and still
           * lets you ask.
           */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 flex flex-col items-center justify-center gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "hatch absolute inset-0 text-ghost",
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 61,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "poster relative text-[clamp(3rem,7vw,5rem)] text-ghostink",
                                children: product.name.split(' ')[0]
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 62,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "label relative bg-bg px-3 py-2 text-dim",
                                children: "Photos on request"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 65,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 60,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "label absolute left-0 top-0 bg-bg px-3 py-2 text-fg",
                        children: index
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "label absolute right-0 top-0 bg-bg px-3 py-2 text-fg",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(product.price)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/ProductCard.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 flex items-start justify-between gap-6 border-t border-line pt-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "poster text-[clamp(1.5rem,3vw,2.25rem)]",
                                children: product.name
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 83,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "label mt-2 text-dim",
                                children: [
                                    product.colour,
                                    product.sizes.length > 0 && ` — ${product.sizes.join(' / ')}`
                                ]
                            }, void 0, true, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 84,
                                columnNumber: 11
                            }, this),
                            product.booking > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "label mt-1 text-hot",
                                children: [
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(product.booking),
                                    " reserves it"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/storefront/components/ProductCard.tsx",
                                lineNumber: 89,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])(`Hi! I want the ${product.name}${product.colour.includes('colour') || product.colour === 'On request' ? '' : ` (${product.colour})`}.`),
                        className: "label shrink-0 border-b-2 border-hot pb-1 text-fg transition-colors hover:text-hot",
                        children: "Enquire →"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/ProductCard.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/ProductCard.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-4 max-w-md text-sm leading-relaxed text-dim",
                children: product.blurb
            }, void 0, false, {
                fileName: "[project]/storefront/components/ProductCard.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/ProductCard.tsx",
        lineNumber: 30,
        columnNumber: 5
    }, this);
}
}),
"[project]/storefront/components/Sections.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Bags",
    ()=>Bags,
    "Booking",
    ()=>Booking,
    "Footer",
    ()=>Footer,
    "Hero",
    ()=>Hero,
    "Nav",
    ()=>Nav,
    "SectionHead",
    ()=>SectionHead,
    "Ticker",
    ()=>Ticker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ui$2f$theme$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/ui/theme.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeSweep$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/ThemeSweep.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Wordmark$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/Wordmark.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/lib/catalogue.ts [app-rsc] (ecmascript)");
;
;
;
;
;
/**
 * How the mark sits at the foot of the page.
 *
 * Kept together and named, because the three are arithmetically linked: the
 * crop box is sized from the mark's aspect, the fraction of the width it
 * takes, and the fraction of it left showing. Change one in isolation and
 * the mark either leaves a gap under itself or loses the wrong amount.
 */ const FOOT_TIGHTEN = 0.72;
const FOOT_WIDTH = 0.46;
const FOOT_SHOWN = 0.9;
/** A thin rule with a mono caption sitting on it - the page's only divider. */ function Rule({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-4 border-t border-line pt-3",
        children: children && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "label text-dim",
            children: children
        }, void 0, false, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 28,
            columnNumber: 20
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
function Nav() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        className: "sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
            className: "mx-auto flex max-w-[104rem] items-center justify-between gap-6 px-5 py-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: "/",
                    className: "shrink-0",
                    "aria-label": "AESTURA, back to the shop",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Wordmark$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Wordmark"], {
                        className: "h-[1.15rem] w-auto sm:h-6"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 60,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 59,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "hidden gap-8 md:flex",
                    children: [
                        [
                            '/#tshirt',
                            'Tees'
                        ],
                        [
                            '/#hoodie',
                            'Hoodies'
                        ],
                        [
                            '/#bag',
                            'Bags'
                        ],
                        [
                            '/#booking',
                            'Booking'
                        ]
                    ].map(([href, text])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: href,
                            className: "label text-dim transition-colors hover:text-fg",
                            children: text
                        }, href, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 70,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 63,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi!'),
                    className: "label bg-hot px-4 py-2 text-bg transition-colors hover:bg-fg",
                    children: "WhatsApp"
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 80,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 45,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 35,
        columnNumber: 5
    }, this);
}
function Hero() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "top",
        className: "border-b border-line",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-[104rem] px-5 pb-10 pt-16 sm:pt-24",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-wrap items-center gap-x-6 gap-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label text-hot",
                            children: "Dadar, Mumbai"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 103,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hatch h-2 w-16 text-hot",
                            "aria-hidden": true
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 104,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label text-dim",
                            children: "Ships pan India"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 105,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label text-dim",
                            children: "Booked on WhatsApp"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 106,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 102,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "poster mt-8 text-[clamp(2.75rem,11vw,9.5rem)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block",
                            children: "Aesthura"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 110,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block text-hot",
                            children: "3Pointer.club"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 111,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 109,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-10 grid gap-8 border-t border-line pt-8 sm:grid-cols-3",
                    children: [
                        [
                            'What',
                            'Printed tees, BAPE hoodies, Nike Elite backpacks.'
                        ],
                        [
                            'How',
                            'Pick it in chat. An advance holds your size. Balance when it is ready.'
                        ],
                        [
                            'Who',
                            'A person confirms every colour, every payment, every order.'
                        ]
                    ].map(([head, body])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "label text-hot",
                                    children: head
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 121,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 max-w-xs text-sm leading-relaxed text-mid",
                                    children: body
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 122,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, head, true, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 120,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 114,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi! I want to see what you have.'),
                    className: "label mt-10 inline-block bg-fg px-7 py-4 text-bg transition-colors hover:bg-hot",
                    children: "Start on WhatsApp →"
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 127,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 101,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
function Ticker() {
    const items = [
        `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(500)} reserves your size`,
        'Pickup from Dadar',
        'Pan India shipping',
        '2 day return & exchange',
        'COD on tees',
        '24 bag colours'
    ];
    const strip = [
        ...items,
        ...items
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "overflow-hidden border-b border-line bg-hot py-2.5",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "ticker-track flex w-max",
            children: strip.map((text, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "label flex items-center whitespace-nowrap text-bg",
                    children: [
                        text,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "mx-6 opacity-60",
                            children: "◆"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 162,
                            columnNumber: 13
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 160,
                    columnNumber: 11
                }, this))
        }, void 0, false, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 158,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 157,
        columnNumber: 5
    }, this);
}
function SectionHead({ id, index, title, note }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        id: id,
        className: "scroll-mt-16 border-b border-line pb-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "label block text-hot",
                children: index
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 186,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "poster mt-4 text-[clamp(2rem,5.5vw,4.25rem)]",
                children: title
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 187,
                columnNumber: 7
            }, this),
            note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-4 max-w-lg text-sm leading-relaxed text-dim",
                children: note
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 188,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 182,
        columnNumber: 5
    }, this);
}
function Booking() {
    const steps = [
        [
            '01',
            'Pick it',
            'Message the design and your size. We quote the price and what reserves it before anything else happens.'
        ],
        [
            '02',
            'Reserve it',
            `Pay the advance on the scanner we send - ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(500)} on a tee, ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(1500)} on a hoodie - and send the screenshot. A person checks it.`
        ],
        [
            '03',
            'Pay the rest when it is ready',
            'Tees go into manufacturing after booking, usually 15-20 days. The balance is due when your piece is ready, not before.'
        ]
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "booking",
        className: "scroll-mt-16 bg-flip text-flipfg",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-[104rem] px-5 py-20 sm:py-28",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border-b-2 border-flipfg pb-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label block text-hot",
                            children: "How it works"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 224,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "poster mt-4 text-[clamp(2rem,5.5vw,4.25rem)]",
                            children: "Booked, not gambled"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 225,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 223,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                    children: steps.map(([n, title, body])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "grid gap-4 border-b border-flipfg/20 py-8 sm:grid-cols-[7rem_1fr_1.6fr] sm:gap-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "poster text-5xl text-flipfg/25",
                                    children: n
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 236,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "poster text-3xl",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 237,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "max-w-xl text-sm leading-relaxed text-flipfg/70",
                                    children: body
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 238,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, n, true, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 232,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 230,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-8 max-w-2xl text-xs leading-relaxed text-flipfg/50",
                    children: [
                        "The advance comes off the total - it is not a fee. COD is available on tees for ",
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(200),
                        " extra. Refunds, returns and exchanges are handled by a person, not a bot."
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 243,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 222,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 221,
        columnNumber: 5
    }, this);
}
function Bags() {
    const bag = __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PRODUCTS"].find((p)=>p.category === 'bag');
    if (!bag) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "mx-auto max-w-[104rem] px-5 py-20 sm:py-28",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(SectionHead, {
                id: "bag",
                index: "03 — 3Pointer.club",
                title: bag.name,
                note: bag.blurb
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 266,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "border border-line",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                            src: bag.images[0],
                            alt: "The Nike Elite backpack colour chart - all twenty-four colours, priced",
                            className: "w-full",
                            loading: "lazy"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 271,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 269,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "poster text-6xl",
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(bag.price)
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 280,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-3 max-w-sm text-sm leading-relaxed text-dim",
                                children: "One price, every colour. Point at the one you want and we confirm it with our supplier before you pay anything."
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 281,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Rule, {
                                children: "All 24 colours"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 286,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-mid",
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAG_COLOURS"].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "flex items-baseline gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-hot",
                                                children: "/"
                                            }, void 0, false, {
                                                fileName: "[project]/storefront/components/Sections.tsx",
                                                lineNumber: 290,
                                                columnNumber: 17
                                            }, this),
                                            c
                                        ]
                                    }, c, true, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 289,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 287,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi! I want a bag - which colours can you confirm?'),
                                className: "label mt-8 inline-block bg-hot px-6 py-3.5 text-bg transition-colors hover:bg-fg",
                                children: "Ask about a colour →"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 296,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 279,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 268,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 265,
        columnNumber: 5
    }, this);
}
function Footer() {
    const year = 2026;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
        className: "border-t border-line",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mx-auto max-w-[104rem] px-5 pt-16",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-8 border-b border-line pb-10 sm:grid-cols-2 lg:grid-cols-4",
                        children: [
                            [
                                'Where',
                                `${__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SHOP"].city}. Pickup available.`
                            ],
                            [
                                'Shipping',
                                __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SHOP"].shipping
                            ],
                            [
                                'Returns',
                                __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SHOP"].returns
                            ],
                            [
                                'Help',
                                'Questions answered on the support page, or by a person on WhatsApp.'
                            ]
                        ].map(([head, body])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "label text-hot",
                                        children: head
                                    }, void 0, false, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 330,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-3 text-sm leading-relaxed text-mid",
                                        children: body
                                    }, void 0, false, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 331,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, head, true, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 329,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 322,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-6 py-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col gap-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "max-w-md text-xs leading-relaxed text-dim",
                                        children: "Prices shown are current. Colours and sizes are confirmed before any payment is taken."
                                    }, void 0, false, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 338,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeSweep$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ThemeSweep"], {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "label text-dim",
                                                    children: "Theme"
                                                }, void 0, false, {
                                                    fileName: "[project]/storefront/components/Sections.tsx",
                                                    lineNumber: 352,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ui$2f$theme$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Theme"], {
                                                    variant: "tabs",
                                                    size: "md",
                                                    showLabel: true,
                                                    themes: [
                                                        'light',
                                                        'dark',
                                                        'system'
                                                    ]
                                                }, void 0, false, {
                                                    fileName: "[project]/storefront/components/Sections.tsx",
                                                    lineNumber: 353,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/storefront/components/Sections.tsx",
                                            lineNumber: 351,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 350,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 337,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi!'),
                                className: "label bg-fg px-6 py-3.5 text-bg transition-colors hover:bg-hot",
                                children: "Message the shop →"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 358,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 336,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-center justify-between gap-4 border-t border-line py-7",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "label text-mid",
                                children: [
                                    "© Copyright ",
                                    year,
                                    " AESTHURA × 3POINTER.CLUB. All rights reserved."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 367,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap gap-7",
                                children: [
                                    [
                                        '/support',
                                        'Support'
                                    ],
                                    [
                                        '/privacy',
                                        'Privacy policy'
                                    ],
                                    [
                                        '/terms',
                                        'Terms & conditions'
                                    ]
                                ].map(([href, text])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: href,
                                        className: "label text-dim transition-colors hover:text-fg",
                                        children: text
                                    }, href, false, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 377,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 371,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 366,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 321,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-hidden": true,
                className: "mt-4 px-5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full [clip-path:inset(-100vh_-100vw_0_-100vw)]",
                    /**
           * Zero height plus a percentage of padding, not aspect-ratio.
           *
           * aspect-ratio is only a PREFERRED size: once the box stopped
           * hiding its overflow it simply grew to fit the mark, the bottom
           * edge landed under the last pixel of it, and the crop quietly
           * stopped existing - measured at 100% shown against a stated 90%.
           *
           * A definite height of zero cannot grow. Percentage padding
           * resolves against the box's own width, which is exactly what is
           * wanted here, so the visible strip stays the same fraction of the
           * mark at every window size.
           */ style: {
                        height: 0,
                        paddingBottom: `${FOOT_SHOWN * FOOT_WIDTH * 100 / (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Wordmark$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["wordmarkAspect"])(FOOT_TIGHTEN)}%`
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$Wordmark$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Wordmark"], {
                        respond: true,
                        tighten: FOOT_TIGHTEN,
                        className: "mx-auto block h-auto overflow-visible text-ghost",
                        style: {
                            width: `${FOOT_WIDTH * 100}%`
                        }
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 444,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 427,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 410,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 320,
        columnNumber: 5
    }, this);
}
}),
"[project]/storefront/components/ThemeSweep.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeSweep",
    ()=>ThemeSweep
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ThemeSweep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ThemeSweep() from the server but ThemeSweep is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ThemeSweep.tsx", "ThemeSweep");
}),
"[project]/storefront/components/ThemeSweep.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeSweep",
    ()=>ThemeSweep
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ThemeSweep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ThemeSweep() from the server but ThemeSweep is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ThemeSweep.tsx <module evaluation>", "ThemeSweep");
}),
"[project]/storefront/components/ThemeSweep.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeSweep$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/storefront/components/ThemeSweep.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeSweep$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/storefront/components/ThemeSweep.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeSweep$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/storefront/components/Wordmark.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * The shop's own wordmark, as vector.
 *
 * The colour baked into the artwork - a near-white meant for a black ground
 * - is stripped, and the mark is painted with currentColor instead, so it
 * takes the colour of whatever it sits in and follows the theme switch
 * without a second copy existing anywhere.
 *
 * The scale transform on each path is kept exactly as exported. Dropping it
 * looked harmless and put the letters roughly four times outside the frame,
 * where they rendered as nothing at all.
 *
 * The seven letters sit in their own groups so the spacing between them can
 * be closed - see `tighten` - and so each can answer the pointer on its own.
 * The E is three bars and travels as one.
 *
 * Each letter is built in two parts: a rectangle that never moves, and the
 * glyph, which does. Hit-testing in SVG follows the painted shape and these
 * letterforms are thin, so without the rectangle the middle of a T was dead
 * space; and with the rectangle inside the moving group, lifting the letter
 * carried its own target out from under the cursor and the whole thing
 * flickered. The target stays put; only the glyph is allowed to move.
 */ __turbopack_context__.s([
    "Wordmark",
    ()=>Wordmark,
    "wordmarkAspect",
    ()=>wordmarkAspect
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
;
function Wordmark({ className, style, tighten = 0, respond = false }) {
    const width = BOX_WIDTH - GAP_TOTAL * tighten;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        /**
       * Cropped to the letters, not to the artboard - they fill under 40% of
       * the exported canvas height, so a height set against that canvas
       * produced letters a third of the size anyone asked for.
       */ viewBox: `115.45 43.77 ${width} 81.87`,
        role: "img",
        "aria-label": "AESTURA",
        className: className,
        style: style,
        fill: "currentColor",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-0.00 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "114.45",
                        y: "43.77",
                        width: "83.21",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 78,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M647.39 189.276C647.834 189.394 648.025 189.429 648.479 189.634C656.87 193.43 804.684 484.046 813.36 511.626C794.354 513.733 771.913 512.989 752.52 512.85C736.498 475.084 714.214 431.864 696.687 394.268C685.154 369.53 664.857 324.833 651.092 303.01C647.071 307 634.237 331.223 631.077 337.117C611.412 374.179 592.575 411.675 574.582 449.577C565.16 469.383 554.573 493.943 544.642 512.863C525.166 513.413 503.712 513.043 484.075 513.115C494.67 492.654 504.482 470.85 514.658 450.061C542.428 391.992 570.962 334.291 600.25 276.972C615.021 248.094 630.631 216.969 647.39 189.276Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 86,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 85,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 75,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-41.78 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "235.44",
                        y: "43.77",
                        width: "61.02",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 92,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                transform: "scale(0.240557 0.240521)",
                                d: "M987.683 187.863C1014.48 186.813 1046.11 187.661 1073.32 187.663L1223.62 187.817L1223.88 241.841C1171.24 243.26 1114.42 241.415 1061.55 241.39C1043.21 241.382 1006.21 241.098 989.63 238.344C987.029 225.704 987.645 201.702 987.683 187.863Z"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Wordmark.tsx",
                                lineNumber: 100,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                transform: "scale(0.240557 0.240521)",
                                d: "M987.253 325.975C1013.6 325.423 1041.83 325.934 1068.3 325.933L1223.8 325.996L1224.06 375.034L987.358 374.952L987.253 325.975Z"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Wordmark.tsx",
                                lineNumber: 101,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                transform: "scale(0.240557 0.240521)",
                                d: "M987.34 464.169C1014.06 463.49 1043.44 464.092 1070.34 464.084L1223.82 464.154C1223.79 480.566 1223.87 496.979 1224.04 513.391L987.556 513.438L987.34 464.169Z"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Wordmark.tsx",
                                lineNumber: 102,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 99,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 89,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-84.81 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "335.48",
                        y: "43.77",
                        width: "68.37",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 108,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M1614 187.518C1625.31 186.962 1638 187.157 1649.43 187.112C1646.46 198.798 1641.07 224.655 1632.76 232.733C1618.65 246.455 1514.9 236.978 1488.06 244C1482.09 245.564 1476.84 248.49 1472.44 252.845C1465.23 259.979 1460.38 270.627 1460.41 280.83C1460.44 288.701 1463.93 295.558 1469.97 300.537C1495.42 321.504 1571.28 328.287 1605.41 341.326C1616.89 345.591 1627.31 352.283 1635.96 360.945C1670.53 395.27 1668.98 453.036 1634.57 486.892C1624.46 496.91 1611.99 504.226 1598.31 508.171C1579.43 513.517 1549 513.096 1529.21 513.266C1499.89 513.453 1470.57 513.349 1441.25 512.952C1427.57 512.338 1416.23 512.365 1402.93 508.797C1403.85 495.94 1413.2 478.296 1418.87 466.383C1429.8 465.478 1445.58 465.518 1456.8 465.192L1528.17 463.063C1541.82 462.67 1585.9 463.518 1593.02 452.075C1625.46 399.925 1581.2 386.566 1540.81 379.425C1482.36 369.093 1405.45 355.664 1404.23 282.276C1403.96 258.082 1413.43 234.796 1430.52 217.662C1440.89 207.12 1453.7 199.301 1467.82 194.899C1486.37 189.308 1516.75 189.265 1536.77 188.784C1562.51 188.208 1588.25 187.786 1614 187.518Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 116,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 115,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 105,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-116.29 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "431.34",
                        y: "43.77",
                        width: "67.84",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 122,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M1801.42 188.112C1809.97 187.244 1824.78 187.674 1833.72 187.684L1890.22 187.721L2066.8 187.821C2066.81 204.627 2065.85 222.262 2065.18 239.117C2031.84 240.678 1997.2 241.191 1963.74 242.09L1963.65 409.5L1963.54 513.086C1947.05 513.979 1921.88 513.56 1905.18 513.164L1905.22 242.044C1871.48 241.305 1837.75 240.395 1804.02 239.316C1803.31 221.929 1802.84 205.486 1801.42 188.112Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 130,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 129,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 119,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-156.74 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "535.64",
                        y: "43.77",
                        width: "73.83",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 136,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M2235.95 186.808C2253.05 188.83 2274.18 188.534 2292.25 190.116L2292.23 191.284C2291.86 226.408 2294.14 265.194 2294.58 301.206C2295.03 338.725 2295.89 383.901 2301.27 420.915C2302.9 428.629 2308.14 435.365 2313.43 440.838C2353.5 482.273 2443.08 476.847 2457.28 413.442C2463.33 386.435 2462.34 350.971 2462.59 322.471L2462.94 187.769C2482.6 187.612 2502.26 187.591 2521.92 187.706L2521.7 239.821C2521.77 266.957 2521.6 294.093 2521.19 321.225C2520.64 373.015 2525.25 436.555 2486.3 476.157C2447.09 516.032 2415.99 517.143 2363.97 517.77C2328.44 518.198 2293.6 501.622 2268.51 476.788C2256.17 464.552 2247.32 449.245 2242.87 432.446C2234.97 402.595 2236.42 344.953 2236.37 312.615L2235.95 186.808Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 144,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 143,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 133,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-199.73 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "648.45",
                        y: "43.77",
                        width: "70.17",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 150,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M2704.89 187.081C2729.79 186.139 2759.65 188.01 2785.05 188.105C2812.43 189.024 2840.5 188.574 2867.72 191.382C2937.23 198.55 2979.02 273.905 2949.61 337.137C2940.1 357.585 2925.37 376.404 2905.75 387.782C2899.27 391.539 2888.12 394.799 2880.87 397.575C2886.14 406.864 2896.43 420.144 2903.04 429.002L2943.34 482.377C2950.5 491.847 2959.81 503.548 2966.11 513.369C2943.77 513.532 2921.42 513.499 2899.07 513.271C2876.32 482.616 2853.88 451.734 2831.75 420.63C2828.25 415.347 2824.32 410.106 2820.58 404.968C2799.92 405.062 2779.25 404.975 2758.59 404.708L2758.41 513.242C2742.36 513.663 2720.92 513.704 2705.06 512.985C2703.94 460.776 2705.01 408.054 2704.72 355.741C2744.89 353.964 2855.36 362.64 2883.29 340.135C2893.82 331.653 2899.39 317.682 2900.76 304.532C2902.51 287.741 2898.89 268.899 2888 255.601C2885.13 252.099 2881.45 248.491 2877.09 246.987C2865.23 242.892 2850.28 243.289 2837.81 242.798C2808.57 241.649 2779.38 241.859 2750.12 241.911C2735.2 241.938 2719.57 242.841 2704.73 241.432C2704.61 223.315 2704.66 205.197 2704.89 187.081Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 158,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 157,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 147,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                className: respond ? 'mark-hit' : undefined,
                transform: `translate(${-231.21 * tighten} 0)`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                        x: "746.10",
                        y: "43.77",
                        width: "83.38",
                        height: "81.87",
                        fill: "transparent"
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 164,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        className: respond ? 'mark-letter' : undefined,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            transform: "scale(0.240557 0.240521)",
                            d: "M3275.1 189.846C3285.58 195.255 3422.97 477.351 3439.86 511.659C3420.07 513.542 3399.47 511.881 3379.57 510.866C3364.11 480.892 3287.49 310.735 3276.9 301.703C3271.75 306.885 3259.82 332.69 3255.52 341.077C3226.42 398.034 3198.29 455.487 3171.16 513.41L3109.88 513.284C3132.25 466.995 3156.87 419.509 3180.19 373.514C3210.48 313.774 3241.94 247.865 3275.1 189.846Z"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Wordmark.tsx",
                            lineNumber: 172,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Wordmark.tsx",
                        lineNumber: 171,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Wordmark.tsx",
                lineNumber: 161,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Wordmark.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, this);
}
const BOX_WIDTH = 713.03;
const BOX_HEIGHT = 81.87;
const GAP_TOTAL = 231.21;
function wordmarkAspect(tighten = 0) {
    return (BOX_WIDTH - GAP_TOTAL * tighten) / BOX_HEIGHT;
}
}),
"[project]/storefront/components/ui/theme.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Theme",
    ()=>Theme,
    "themeConfigs",
    ()=>themeConfigs
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const Theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Theme() from the server but Theme is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ui/theme.tsx", "Theme");
const themeConfigs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call themeConfigs() from the server but themeConfigs is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ui/theme.tsx", "themeConfigs");
}),
"[project]/storefront/components/ui/theme.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Theme",
    ()=>Theme,
    "themeConfigs",
    ()=>themeConfigs
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const Theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Theme() from the server but Theme is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ui/theme.tsx <module evaluation>", "Theme");
const themeConfigs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call themeConfigs() from the server but themeConfigs is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ui/theme.tsx <module evaluation>", "themeConfigs");
}),
"[project]/storefront/components/ui/theme.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ui$2f$theme$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/storefront/components/ui/theme.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ui$2f$theme$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/storefront/components/ui/theme.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ui$2f$theme$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/storefront/lib/catalogue.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * What the shop sells, written down.
 *
 * These are the real rows from the bot's catalogue - the same names, prices
 * and booking amounts a customer is quoted on WhatsApp. Keeping them in one
 * file is what makes the site static today and easy to make live tomorrow:
 * every component takes a `Product`, so when this file starts reading
 * Supabase instead of holding literals, nothing above it changes.
 *
 * Two rules borrowed from the bot, because a shop front can lie in exactly
 * the same ways a chat can:
 *
 *   - No price appears here that is not the price. A number on a website is
 *     a promise, and the shop has to honour it.
 *   - Nothing is described as in stock. The bag is sold off a printed chart
 *     in twenty-four colours and the shop confirms availability with its
 *     supplier after you choose one; saying "in stock" would be inventing a
 *     fact nobody has.
 */ __turbopack_context__.s([
    "BAG_COLOURS",
    ()=>BAG_COLOURS,
    "CATEGORIES",
    ()=>CATEGORIES,
    "PRODUCTS",
    ()=>PRODUCTS,
    "SHOP",
    ()=>SHOP,
    "rupees",
    ()=>rupees,
    "whatsappLink",
    ()=>whatsappLink
]);
const SHOP = {
    whatsapp: '919799757664',
    city: 'Dadar, Mumbai',
    shipping: 'Ships all over India. Pickup from Dadar available.',
    returns: '2 day return & exchange'
};
function whatsappLink(text) {
    return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;
}
const PRODUCTS = [
    {
        slug: 'spiderman',
        name: 'Spider-Man',
        brand: 'AESTHURA',
        category: 'tshirt',
        price: 2499,
        booking: 500,
        colour: 'Red',
        sizes: [
            'S',
            'M',
            'L',
            'XL',
            'XXL'
        ],
        images: [
            '/products/spiderman-front.png',
            '/products/spiderman-full.png',
            '/products/spiderman-back.png'
        ],
        fit: 'cover',
        blurb: 'Cotton with a little stretch. Raised web lines across the body and a raised web logo, printed to hold its edge.'
    },
    {
        slug: 'venom',
        name: 'Venom',
        brand: 'AESTHURA',
        category: 'tshirt',
        price: 2499,
        booking: 500,
        colour: 'Black',
        sizes: [
            'S',
            'M',
            'L',
            'XL',
            'XXL'
        ],
        images: [
            '/products/venom-front.jpeg',
            '/products/venom-full.jpeg',
            '/products/venom-back.jpeg'
        ],
        fit: 'cover',
        blurb: 'The black cut of the same build - cotton with a little stretch, raised texture, high-quality print.'
    },
    {
        slug: 'bape-single-hood',
        name: 'BAPE Single Hood',
        brand: 'AESTHURA',
        category: 'hoodie',
        price: 3999,
        booking: 1500,
        colour: 'On request',
        sizes: [
            'S',
            'M',
            'L',
            'XL',
            'XXL'
        ],
        images: [],
        fit: 'cover',
        blurb: 'Special order from China, generally 15-20 days. All sizes and colours can be ordered subject to confirmation.'
    },
    {
        slug: 'bape-double-hood',
        name: 'BAPE Double Hood',
        brand: 'AESTHURA',
        category: 'hoodie',
        price: 4599,
        booking: 1500,
        colour: 'On request',
        sizes: [
            'S',
            'M',
            'L',
            'XL',
            'XXL'
        ],
        images: [],
        fit: 'cover',
        blurb: 'The double hood cut. Special order, generally 15-20 days, sizes and colours confirmed before booking.'
    },
    {
        slug: 'nike-elite-backpack',
        name: 'Nike Elite Backpack',
        brand: '3POINTER.CLUB',
        category: 'bag',
        price: 2499,
        booking: 0,
        colour: '24 colours',
        sizes: [],
        images: [
            '/products/bag-chart.png'
        ],
        fit: 'contain',
        blurb: 'Spacious compartments, padded straps, built for daily carry. Twenty-four colours on the chart - pick one and we confirm it for you.'
    }
];
const CATEGORIES = [
    {
        key: 'tshirt',
        label: 'T-Shirts',
        note: 'AESTHURA'
    },
    {
        key: 'hoodie',
        label: 'Hoodies',
        note: 'BAPE & more'
    },
    {
        key: 'bag',
        label: 'Bags',
        note: '3POINTER.CLUB'
    }
];
const BAG_COLOURS = [
    'Sky Blue',
    'Black',
    'Lake Blue',
    'Ocean Blue',
    'Orange',
    'Blue',
    'Light Purple',
    'Dark Purple',
    'Original Pink',
    'White',
    'Pink Pattern',
    'Original Dark Blue',
    'Black & White',
    'Black / White Logo',
    'Black / Gold Logo',
    'Red',
    'Gray',
    'White & Gold',
    'Speckled White',
    'Dark Gray',
    'Black & Green',
    'Dark Blue',
    'Black & Pink',
    'Black & Gold'
];
const rupees = (n)=>`₹${n.toLocaleString('en-IN')}`;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0ww96rv._.js.map