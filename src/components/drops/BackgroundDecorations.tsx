import cheeseLogo from "@/assets/cheese-logo.png";

export function BackgroundDecorations() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <img
        src={cheeseLogo}
        alt=""
        className="absolute -top-8 -left-8 w-48 h-48 opacity-10 rotate-12"
      />
      <img
        src={cheeseLogo}
        alt=""
        className="absolute -top-8 -right-8 w-48 h-48 opacity-10 -rotate-12"
      />
      <img
        src={cheeseLogo}
        alt=""
        className="absolute -bottom-8 -left-8 w-48 h-48 opacity-10 -rotate-12"
      />
      <img
        src={cheeseLogo}
        alt=""
        className="absolute -bottom-8 -right-8 w-48 h-48 opacity-10 rotate-12"
      />
    </div>
  );
}
