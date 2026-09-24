(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/storefront/components/ThemeToggle.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeToggle",
    ()=>ThemeToggle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/storefront/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function ThemeToggle() {
    _s();
    const [theme, setTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeToggle.useEffect": ()=>{
            const stored = window.localStorage.getItem('theme');
            if (stored === 'dark' || stored === 'light') {
                setTheme(stored);
                return;
            }
            setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        }
    }["ThemeToggle.useEffect"], []);
    function flip() {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem('theme', next);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: flip,
        "aria-label": theme ? `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` : 'Switch theme',
        className: "label border border-line px-3 py-2 text-dim transition-colors hover:border-hot hover:text-hot",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$storefront$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            "aria-hidden": true,
            children: theme === 'light' ? 'Dark' : theme === 'dark' ? 'Light' : '—'
        }, void 0, false, {
            fileName: "[project]/storefront/components/ThemeToggle.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/storefront/components/ThemeToggle.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
_s(ThemeToggle, "8cORP+VmZIUfFKJJBlFCtPazdq0=");
_c = ThemeToggle;
var _c;
__turbopack_context__.k.register(_c, "ThemeToggle");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=storefront_components_ThemeToggle_tsx_0hiwoqz._.js.map