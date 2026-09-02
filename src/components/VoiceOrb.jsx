export default function VoiceOrb({ active = true }) {
  return (
    <div className={`voice-orb${active ? " active" : ""}`} aria-hidden="true">
      <span className="orb-ring" />
      <span className="orb-ring delay-1" />
      <span className="orb-ring delay-2" />
      <div className="orb-core">
        <span className="orb-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
