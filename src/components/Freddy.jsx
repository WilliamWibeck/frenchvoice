export default function Freddy({ size = "md", className = "" }) {
  return (
    <div className={`freddy-wrap ${size} ${className}`.trim()} aria-hidden="true">
      <svg className="freddy" viewBox="0 0 96 108" xmlns="http://www.w3.org/2000/svg">
        <g className="freddy-puffs">
          <circle className="fur" cx="70" cy="80" r="10" />
          <circle className="fur" cx="48" cy="86" r="18" />
          <circle className="fur" cx="32" cy="90" r="11" />
          <circle className="fur" cx="64" cy="90" r="11" />
          <circle className="fur" cx="38" cy="101" r="7.5" />
          <circle className="fur" cx="58" cy="101" r="7.5" />

          <circle className="fur" cx="20" cy="46" r="13" />
          <circle className="fur" cx="76" cy="46" r="13" />

          <circle className="fur" cx="48" cy="32" r="26" />
          <circle className="fur" cx="48.0" cy="6.0" r="7.5" />
          <circle className="fur" cx="57.9" cy="8.0" r="7.5" />
          <circle className="fur" cx="66.4" cy="13.7" r="7.5" />
          <circle className="fur" cx="72.1" cy="22.1" r="7.5" />
          <circle className="fur" cx="74.0" cy="32.0" r="7.5" />
          <circle className="fur" cx="72.1" cy="41.9" r="7.5" />
          <circle className="fur" cx="66.4" cy="50.3" r="7.5" />
          <circle className="fur" cx="57.9" cy="56.0" r="7.5" />
          <circle className="fur" cx="48.0" cy="58.0" r="7.5" />
          <circle className="fur" cx="38.1" cy="56.0" r="7.5" />
          <circle className="fur" cx="29.6" cy="50.3" r="7.5" />
          <circle className="fur" cx="23.9" cy="41.9" r="7.5" />
          <circle className="fur" cx="22.0" cy="32.0" r="7.5" />
          <circle className="fur" cx="23.9" cy="22.1" r="7.5" />
          <circle className="fur" cx="29.6" cy="13.7" r="7.5" />
          <circle className="fur" cx="38.1" cy="8.0" r="7.5" />

          <path className="curl" d="M30 12c4-5 8-2 6 3" />
          <path className="curl" d="M62 11c5-4 8 1 5 5" />
          <path className="curl" d="M72 28c5 1 5 7 0 8" />
          <path className="curl" d="M22 26c-5 2-4 7 2 8" />
          <path className="curl" d="M26 48c-3 4 2 7 6 4" />
          <path className="curl" d="M66 49c4 4 8 0 6-4" />
        </g>

        <path className="bow" d="M40 62c-6-4-8 2-4 5 4 2 8-1 8-3 0 2 4 5 8 3 4-3 2-9-4-5-1 1-3 1-4 0z" />
        <circle className="bow-knot" cx="48" cy="63.5" r="2.4" />

        <ellipse className="fur" cx="48" cy="42" rx="10" ry="7" />
        <ellipse className="blush" cx="32" cy="36" rx="6" ry="3.6" />
        <ellipse className="blush" cx="64" cy="36" rx="6" ry="3.6" />

        <circle className="freddy-eye" cx="38" cy="30" r="6.2" />
        <circle className="freddy-eye delay" cx="58" cy="30" r="6.2" />
        <circle className="glint" cx="36.2" cy="28.2" r="1.7" />
        <circle className="glint" cx="56.2" cy="28.2" r="1.7" />

        <ellipse className="ink" cx="48" cy="42" rx="6" ry="4.8" />
        <ellipse className="glint" cx="46.3" cy="40.5" rx="1.6" ry="1.1" />
        <path className="smile" d="M41.5 47.5c2.4 3.1 10.6 3.1 13 0" />
        <circle className="pad" cx="38" cy="102" r="1.5" />
        <circle className="pad" cx="58" cy="102" r="1.5" />
      </svg>
    </div>
  );
}
