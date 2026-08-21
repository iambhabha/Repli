module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
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
                                className: "poster text-[clamp(1.75rem,3.5vw,2.75rem)]",
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
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/components/ThemeToggle.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/lib/catalogue.ts [app-rsc] (ecmascript)");
;
;
;
/** A thin rule with a mono caption sitting on it - the page's only divider. */ function Rule({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-4 border-t border-line pt-3",
        children: children && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "label text-dim",
            children: children
        }, void 0, false, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 14,
            columnNumber: 20
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 13,
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
                    href: "#top",
                    className: "label whitespace-nowrap",
                    children: [
                        "AESTHURA ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-hot",
                            children: "×"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 24,
                            columnNumber: 20
                        }, this),
                        " 3POINTER.CLUB"
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "hidden gap-8 md:flex",
                    children: [
                        [
                            '#tshirt',
                            'Tees'
                        ],
                        [
                            '#hoodie',
                            'Hoodies'
                        ],
                        [
                            '#bag',
                            'Bags'
                        ],
                        [
                            '#booking',
                            'Booking'
                        ]
                    ].map(([href, text])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: href,
                            className: "label text-dim transition-colors hover:text-fg",
                            children: text
                        }, href, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 34,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 27,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ThemeToggle"], {}, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 45,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi!'),
                            className: "label bg-hot px-4 py-2 text-bg transition-colors hover:bg-fg",
                            children: "WhatsApp"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 46,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 44,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 22,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 21,
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
                            lineNumber: 70,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hatch h-2 w-16 text-hot",
                            "aria-hidden": true
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 71,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label text-dim",
                            children: "Ships pan India"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 72,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "label text-dim",
                            children: "Booked on WhatsApp"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 73,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 69,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "poster mt-8 text-[clamp(3.25rem,14.5vw,13rem)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block",
                            children: "Aesthura"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 77,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block text-hot",
                            children: "3Pointer.club"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 78,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 76,
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
                                    lineNumber: 88,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 max-w-xs text-sm leading-relaxed text-mid",
                                    children: body
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 89,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, head, true, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 87,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 81,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi! I want to see what you have.'),
                    className: "label mt-10 inline-block bg-fg px-7 py-4 text-bg transition-colors hover:bg-hot",
                    children: "Start on WhatsApp →"
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 94,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 68,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 67,
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
                            lineNumber: 129,
                            columnNumber: 13
                        }, this)
                    ]
                }, i, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 127,
                    columnNumber: 11
                }, this))
        }, void 0, false, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 125,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 124,
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
                lineNumber: 153,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "poster mt-4 text-[clamp(2.5rem,7vw,5.5rem)]",
                children: title
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 154,
                columnNumber: 7
            }, this),
            note && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-4 max-w-lg text-sm leading-relaxed text-dim",
                children: note
            }, void 0, false, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 155,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 149,
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
                            lineNumber: 191,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "poster mt-4 text-[clamp(2.5rem,7vw,5.5rem)]",
                            children: "Booked, not gambled"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 192,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 190,
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
                                    lineNumber: 203,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "poster text-3xl",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 204,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "max-w-xl text-sm leading-relaxed text-flipfg/70",
                                    children: body
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 205,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, n, true, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 199,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 197,
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
                    lineNumber: 210,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 189,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 188,
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
                lineNumber: 233,
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
                            lineNumber: 238,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 236,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "poster text-6xl",
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["rupees"])(bag.price)
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 247,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-3 max-w-sm text-sm leading-relaxed text-dim",
                                children: "One price, every colour. Point at the one you want and we confirm it with our supplier before you pay anything."
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 248,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Rule, {
                                children: "All 24 colours"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 253,
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
                                                lineNumber: 257,
                                                columnNumber: 17
                                            }, this),
                                            c
                                        ]
                                    }, c, true, {
                                        fileName: "[project]/storefront/components/Sections.tsx",
                                        lineNumber: 256,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi! I want a bag - which colours can you confirm?'),
                                className: "label mt-8 inline-block bg-hot px-6 py-3.5 text-bg transition-colors hover:bg-fg",
                                children: "Ask about a colour →"
                            }, void 0, false, {
                                fileName: "[project]/storefront/components/Sections.tsx",
                                lineNumber: 263,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/storefront/components/Sections.tsx",
                        lineNumber: 246,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/storefront/components/Sections.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 232,
        columnNumber: 5
    }, this);
}
function Footer() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
        className: "border-t border-line",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto max-w-[104rem] px-5 py-16",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-8 border-b border-line pb-10 sm:grid-cols-3",
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
                        ]
                    ].map(([head, body])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "label text-hot",
                                    children: head
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 286,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-3 text-sm leading-relaxed text-mid",
                                    children: body
                                }, void 0, false, {
                                    fileName: "[project]/storefront/components/Sections.tsx",
                                    lineNumber: 287,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, head, true, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 285,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 279,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "poster mt-10 text-[clamp(2rem,9vw,8rem)]",
                    children: [
                        "Aesthura ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-hot",
                            children: "×"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 293,
                            columnNumber: 20
                        }, this),
                        " 3Pointer.club"
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 292,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-8 flex flex-wrap items-center justify-between gap-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "max-w-md text-xs leading-relaxed text-dim",
                            children: "Prices shown are current. Colours and sizes are confirmed before any payment is taken."
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 297,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$lib$2f$catalogue$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["whatsappLink"])('Hi!'),
                            className: "label bg-fg px-6 py-3.5 text-bg transition-colors hover:bg-hot",
                            children: "Message the shop →"
                        }, void 0, false, {
                            fileName: "[project]/storefront/components/Sections.tsx",
                            lineNumber: 301,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/storefront/components/Sections.tsx",
                    lineNumber: 296,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/storefront/components/Sections.tsx",
            lineNumber: 278,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/Sections.tsx",
        lineNumber: 277,
        columnNumber: 5
    }, this);
}
}),
"[project]/storefront/components/ThemeToggle.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeToggle",
    ()=>ThemeToggle
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ThemeToggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ThemeToggle() from the server but ThemeToggle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ThemeToggle.tsx", "ThemeToggle");
}),
"[project]/storefront/components/ThemeToggle.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeToggle",
    ()=>ThemeToggle
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ThemeToggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ThemeToggle() from the server but ThemeToggle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/storefront/components/ThemeToggle.tsx <module evaluation>", "ThemeToggle");
}),
"[project]/storefront/components/ThemeToggle.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/storefront/components/ThemeToggle.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/storefront/components/ThemeToggle.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
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

//# sourceMappingURL=%5Broot-of-the-server%5D__00k93oc._.js.map