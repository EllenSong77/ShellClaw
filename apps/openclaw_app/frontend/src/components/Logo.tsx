interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-sm' },
    md: { container: 'w-12 h-12', text: 'text-lg' },
    lg: { container: 'w-16 h-16', text: 'text-2xl' },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <div className={`${s.container} rounded-lg overflow-hidden flex items-center justify-center bg-[#22D3EE]/10`}>
        <img src="/Logo.png" alt="ShellClaw logo" className="w-full h-full object-contain" />
      </div>
      {showText && (
        <span className={`font-semibold tracking-tight ${s.text}`}>
          <span className="text-[#22D3EE]">Shell</span>
          <span className="text-[#FAFAFA]">Claw</span>
        </span>
      )}
    </div>
  );
}
