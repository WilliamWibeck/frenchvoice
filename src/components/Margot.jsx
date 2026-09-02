export default function Margot({ size = "md", className = "" }) {
  return (
    <div className={`margot-wrap ${size} ${className}`.trim()} aria-hidden="true">
      <div className="margot">
        <div className="margot-body" />
        <div className="margot-beret">
          <div className="margot-pom" />
        </div>
        <div className="margot-eye left" />
        <div className="margot-eye right" />
        <div className="margot-smile" />
        <div className="margot-blush left" />
        <div className="margot-blush right" />
      </div>
    </div>
  );
}
