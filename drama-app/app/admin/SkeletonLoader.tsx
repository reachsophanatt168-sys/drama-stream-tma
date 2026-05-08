export default function SkeletonLoader() {
  return (
    <div className="h-screen w-full bg-[var(--tg-theme-bg-color,#000)] overflow-hidden relative animate-pulse flex flex-col justify-end p-4">
      {/* Mock Video Container */}
      <div className="absolute inset-0 bg-[var(--tg-theme-secondary-bg-color,#111)] z-0" />
      
      {/* Mock Content */}
      <div className="relative z-10 w-full mb-10">
        <div className="w-3/4 h-6 bg-slate-700/50 rounded-md mb-3" />
        <div className="w-1/2 h-4 bg-slate-700/50 rounded-md" />
      </div>

      {/* Mock Right Side Buttons */}
      <div className="absolute right-4 bottom-24 flex flex-col space-y-6 z-10">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 bg-slate-700/50 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 bg-slate-700/50 rounded-full" />
        </div>
      </div>
    </div>
  );
}