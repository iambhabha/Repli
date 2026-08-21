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
 */
export function Wordmark({
  className,
  style,
  tighten = 0,
  respond = false,
}: {
  className?: string;
  /** For the one thing a class cannot say: a width computed from the aspect. */
  style?: React.CSSProperties;
  /**
   * How much of the space between letters to take out, 0 to 1.
   *
   * The artwork is drawn with gaps that are 56% of a letter's width. At the
   * size it runs in the bar that reads as confident; blown across the foot
   * of the page it reads as loose, because tracking that suits small type is
   * always too open once the same letters are 150 pixels tall. This closes
   * every gap by the same proportion and shrinks the box to match, so the
   * mark stays centred and keeps its own proportions - nothing is stretched.
   *
   * Expect to need a high number where the mark runs full width. Shrinking
   * the box means the same pixels now hold fewer units, so the letters grow
   * as the gaps close and the two changes partly cancel: at 0.5 the gaps had
   * genuinely halved and it still looked untouched.
   */
  tighten?: number;
  /**
   * Whether the letters answer the pointer.
   *
   * Off by default so a mark can be dropped anywhere without bringing an
   * interaction with it. Both marks on this site turn it on: the one at the
   * foot because it is large and there is nothing else down there, and the
   * one in the bar because the same gesture should do the same thing in both
   * places - a letter that lights under the cursor at the bottom of the page
   * and sits inert at the top reads as one of them being broken.
   *
   * It costs the link nothing. The glow is read per letter and the anchor
   * still takes the whole mark, so the click target is unchanged.
   */
  respond?: boolean;
}) {
  const width = BOX_WIDTH - GAP_TOTAL * tighten;

  return (
    <svg
      /**
       * Cropped to the letters, not to the artboard - they fill under 40% of
       * the exported canvas height, so a height set against that canvas
       * produced letters a third of the size anyone asked for.
       */
      viewBox={`115.45 43.77 ${width} 81.87`}
      role="img"
      aria-label="AESTURA"
      className={className}
      style={style}
      fill="currentColor"
    >
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-0.00 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="114.45"
            y="43.77"
            width="83.21"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M647.39 189.276C647.834 189.394 648.025 189.429 648.479 189.634C656.87 193.43 804.684 484.046 813.36 511.626C794.354 513.733 771.913 512.989 752.52 512.85C736.498 475.084 714.214 431.864 696.687 394.268C685.154 369.53 664.857 324.833 651.092 303.01C647.071 307 634.237 331.223 631.077 337.117C611.412 374.179 592.575 411.675 574.582 449.577C565.16 469.383 554.573 493.943 544.642 512.863C525.166 513.413 503.712 513.043 484.075 513.115C494.67 492.654 504.482 470.85 514.658 450.061C542.428 391.992 570.962 334.291 600.25 276.972C615.021 248.094 630.631 216.969 647.39 189.276Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-41.78 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="235.44"
            y="43.77"
            width="61.02"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M987.683 187.863C1014.48 186.813 1046.11 187.661 1073.32 187.663L1223.62 187.817L1223.88 241.841C1171.24 243.26 1114.42 241.415 1061.55 241.39C1043.21 241.382 1006.21 241.098 989.63 238.344C987.029 225.704 987.645 201.702 987.683 187.863Z"/>
            <path transform="scale(0.240557 0.240521)" d="M987.253 325.975C1013.6 325.423 1041.83 325.934 1068.3 325.933L1223.8 325.996L1224.06 375.034L987.358 374.952L987.253 325.975Z"/>
            <path transform="scale(0.240557 0.240521)" d="M987.34 464.169C1014.06 463.49 1043.44 464.092 1070.34 464.084L1223.82 464.154C1223.79 480.566 1223.87 496.979 1224.04 513.391L987.556 513.438L987.34 464.169Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-84.81 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="335.48"
            y="43.77"
            width="68.37"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M1614 187.518C1625.31 186.962 1638 187.157 1649.43 187.112C1646.46 198.798 1641.07 224.655 1632.76 232.733C1618.65 246.455 1514.9 236.978 1488.06 244C1482.09 245.564 1476.84 248.49 1472.44 252.845C1465.23 259.979 1460.38 270.627 1460.41 280.83C1460.44 288.701 1463.93 295.558 1469.97 300.537C1495.42 321.504 1571.28 328.287 1605.41 341.326C1616.89 345.591 1627.31 352.283 1635.96 360.945C1670.53 395.27 1668.98 453.036 1634.57 486.892C1624.46 496.91 1611.99 504.226 1598.31 508.171C1579.43 513.517 1549 513.096 1529.21 513.266C1499.89 513.453 1470.57 513.349 1441.25 512.952C1427.57 512.338 1416.23 512.365 1402.93 508.797C1403.85 495.94 1413.2 478.296 1418.87 466.383C1429.8 465.478 1445.58 465.518 1456.8 465.192L1528.17 463.063C1541.82 462.67 1585.9 463.518 1593.02 452.075C1625.46 399.925 1581.2 386.566 1540.81 379.425C1482.36 369.093 1405.45 355.664 1404.23 282.276C1403.96 258.082 1413.43 234.796 1430.52 217.662C1440.89 207.12 1453.7 199.301 1467.82 194.899C1486.37 189.308 1516.75 189.265 1536.77 188.784C1562.51 188.208 1588.25 187.786 1614 187.518Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-116.29 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="431.34"
            y="43.77"
            width="67.84"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M1801.42 188.112C1809.97 187.244 1824.78 187.674 1833.72 187.684L1890.22 187.721L2066.8 187.821C2066.81 204.627 2065.85 222.262 2065.18 239.117C2031.84 240.678 1997.2 241.191 1963.74 242.09L1963.65 409.5L1963.54 513.086C1947.05 513.979 1921.88 513.56 1905.18 513.164L1905.22 242.044C1871.48 241.305 1837.75 240.395 1804.02 239.316C1803.31 221.929 1802.84 205.486 1801.42 188.112Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-156.74 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="535.64"
            y="43.77"
            width="73.83"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M2235.95 186.808C2253.05 188.83 2274.18 188.534 2292.25 190.116L2292.23 191.284C2291.86 226.408 2294.14 265.194 2294.58 301.206C2295.03 338.725 2295.89 383.901 2301.27 420.915C2302.9 428.629 2308.14 435.365 2313.43 440.838C2353.5 482.273 2443.08 476.847 2457.28 413.442C2463.33 386.435 2462.34 350.971 2462.59 322.471L2462.94 187.769C2482.6 187.612 2502.26 187.591 2521.92 187.706L2521.7 239.821C2521.77 266.957 2521.6 294.093 2521.19 321.225C2520.64 373.015 2525.25 436.555 2486.3 476.157C2447.09 516.032 2415.99 517.143 2363.97 517.77C2328.44 518.198 2293.6 501.622 2268.51 476.788C2256.17 464.552 2247.32 449.245 2242.87 432.446C2234.97 402.595 2236.42 344.953 2236.37 312.615L2235.95 186.808Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-199.73 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="648.45"
            y="43.77"
            width="70.17"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M2704.89 187.081C2729.79 186.139 2759.65 188.01 2785.05 188.105C2812.43 189.024 2840.5 188.574 2867.72 191.382C2937.23 198.55 2979.02 273.905 2949.61 337.137C2940.1 357.585 2925.37 376.404 2905.75 387.782C2899.27 391.539 2888.12 394.799 2880.87 397.575C2886.14 406.864 2896.43 420.144 2903.04 429.002L2943.34 482.377C2950.5 491.847 2959.81 503.548 2966.11 513.369C2943.77 513.532 2921.42 513.499 2899.07 513.271C2876.32 482.616 2853.88 451.734 2831.75 420.63C2828.25 415.347 2824.32 410.106 2820.58 404.968C2799.92 405.062 2779.25 404.975 2758.59 404.708L2758.41 513.242C2742.36 513.663 2720.92 513.704 2705.06 512.985C2703.94 460.776 2705.01 408.054 2704.72 355.741C2744.89 353.964 2855.36 362.64 2883.29 340.135C2893.82 331.653 2899.39 317.682 2900.76 304.532C2902.51 287.741 2898.89 268.899 2888 255.601C2885.13 252.099 2881.45 248.491 2877.09 246.987C2865.23 242.892 2850.28 243.289 2837.81 242.798C2808.57 241.649 2779.38 241.859 2750.12 241.911C2735.2 241.938 2719.57 242.841 2704.73 241.432C2704.61 223.315 2704.66 205.197 2704.89 187.081Z"/>
          </g>
        </g>
        <g className={respond ? 'mark-hit' : undefined} transform={`translate(${-231.21 * tighten} 0)`}>
          {/* The letter's whole box, invisible, and deliberately outside the
              group that moves - see mark-hit in globals.css. */}
          <rect
            x="746.10"
            y="43.77"
            width="83.38"
            height="81.87"
            fill="transparent"
          />
          <g className={respond ? 'mark-letter' : undefined}>
            <path transform="scale(0.240557 0.240521)" d="M3275.1 189.846C3285.58 195.255 3422.97 477.351 3439.86 511.659C3420.07 513.542 3399.47 511.881 3379.57 510.866C3364.11 480.892 3287.49 310.735 3276.9 301.703C3271.75 306.885 3259.82 332.69 3255.52 341.077C3226.42 398.034 3198.29 455.487 3171.16 513.41L3109.88 513.284C3132.25 466.995 3156.87 419.509 3180.19 373.514C3210.48 313.774 3241.94 247.865 3275.1 189.846Z"/>
          </g>
        </g>
    </svg>
  );
}

const BOX_WIDTH = 713.03;
const BOX_HEIGHT = 81.87;
const GAP_TOTAL = 231.21;

/**
 * How wide the mark is for its height, once the spacing has been closed.
 *
 * Anything that wants to crop the mark has to know this: a box that hides
 * part of it must be sized against the mark's own proportions, and those
 * change with `tighten`. Exporting it keeps the two from drifting apart - a
 * different tightening moves the crop with it, instead of quietly leaving a
 * gap or cutting the wrong amount off.
 */
export function wordmarkAspect(tighten = 0) {
  return (BOX_WIDTH - GAP_TOTAL * tighten) / BOX_HEIGHT;
}
