/** Eyebrow, serif heading and a short lede, used by every homepage section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  center = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-[clamp(2.1rem,4.6vw,3.4rem)] leading-[1.08]">
        {title}
      </h2>
      {lede ? <p className={`mt-5 text-xl text-muted ${center ? "mx-auto" : ""} max-w-[46ch]`}>{lede}</p> : null}
    </div>
  );
}
